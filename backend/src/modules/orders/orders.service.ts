import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order, OrderStatus } from "../../database/entities/order.entity";
import { Cart } from "../../database/entities/cart.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Product } from "../../database/entities/product.entity";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocodesService } from "../shop-promocodes/shop-promocodes.service";
import { CartService } from "../cart/cart.service";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ShopPromocodesService))
    private readonly shopPromocodesService: ShopPromocodesService,
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService
  ) {}

  /**
   * Создать заказ из корзины
   */
  async createOrder(
    botId: string,
    telegramUsername: string,
    createOrderDto: CreateOrderDto
  ): Promise<Order> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем корзину пользователя
    const cart = await this.cartRepository.findOne({
      where: { botId, telegramUsername },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException("Корзина пуста");
    }

    // Проверяем наличие товаров и их количество
    for (const item of cart.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, botId },
      });

      if (!product) {
        throw new NotFoundException(`Товар с ID ${item.productId} не найден`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Товар "${product.name}" неактивен`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Недостаточно товара "${product.name}" в наличии. Доступно: ${product.stockQuantity}, требуется: ${item.quantity}`
        );
      }
    }

    // Получаем информацию о примененном промокоде и рассчитываем итоговую цену
    let finalPrice = cart.totalPrice;
    let promocodeDiscount = 0;
    let appliedPromocodeId: string | null = null;

    if (cart.appliedPromocodeId) {
      const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
        botId,
        cart
      );

      if (promocodeInfo && promocodeInfo.discount) {
        promocodeDiscount = promocodeInfo.discount;
        finalPrice = cart.totalPrice - promocodeDiscount;
        appliedPromocodeId = cart.appliedPromocodeId;

        // Обновляем счетчик использований промокода
        await this.shopPromocodesService.incrementUsageCount(
          cart.appliedPromocodeId
        );
      } else {
        // Промокод стал недействителен, удаляем его из корзины
        cart.appliedPromocodeId = null;
        await this.cartRepository.save(cart);
      }
    }

    // Создаем заказ на основе корзины
    const order = this.orderRepository.create({
      botId,
      telegramUsername,
      items: [...cart.items], // Копируем товары из корзины
      customerData: createOrderDto.customerData,
      additionalMessage: createOrderDto.additionalMessage,
      status: OrderStatus.PENDING,
      totalPrice: finalPrice, // Итоговая цена с учетом скидки
      currency: cart.currency,
      appliedPromocodeId: appliedPromocodeId,
      promocodeDiscount: promocodeDiscount > 0 ? promocodeDiscount : null,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Отправляем уведомление владельцу бота
    await this.sendOrderNotification(
      bot,
      NotificationType.ORDER_CREATED,
      savedOrder
    );

    // Очищаем корзину после создания заказа
    cart.items = [];
    cart.appliedPromocodeId = null; // Удаляем примененный промокод
    await this.cartRepository.save(cart);

    this.logger.log(
      `Заказ ${savedOrder.id} создан для пользователя ${telegramUsername} в боте ${botId}`
    );

    return savedOrder;
  }

  /**
   * Получить заказ пользователя
   */
  async getOrder(
    botId: string,
    orderId: string,
    telegramUsername: string
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, botId, telegramUsername },
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    return order;
  }

  /**
   * Получить все заказы пользователя для бота
   */
  async getOrdersByUser(
    botId: string,
    telegramUsername: string
  ): Promise<Order[]> {
    const orders = await this.orderRepository.find({
      where: { botId, telegramUsername },
      order: { createdAt: "DESC" },
    });

    return orders;
  }

  /**
   * Получить все заказы бота (для админа)
   */
  async getOrdersByBotId(
    botId: string,
    status?: OrderStatus
  ): Promise<
    Array<
      Partial<Order> & {
        id: string;
        botId: string;
        telegramUsername: string;
        items: Order["items"];
        customerData: Order["customerData"];
        additionalMessage?: string;
        status: OrderStatus;
        totalPrice: number;
        currency: string;
        createdAt: Date;
        updatedAt: Date;
        chatId?: string;
      }
    >
  > {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    const where: any = { botId };
    if (status) {
      where.status = status;
    }

    const orders = await this.orderRepository.find({
      where,
      order: { createdAt: "DESC" },
    });

    // Получаем chatId и информацию о промокодах для каждого заказа
    const ordersWithChatId = await Promise.all(
      orders.map(async (order) => {
        // Пытаемся найти chatId по telegramUsername через метаданные сообщений
        const username = order.telegramUsername.replace("@", "");
        const userMessage = await this.messageRepository
          .createQueryBuilder("message")
          .where("message.botId = :botId", { botId })
          .andWhere("message.type = :type", { type: "incoming" })
          .andWhere(
            "(message.metadata->>'username' = :username OR message.metadata->>'username' = :usernameWithAt)",
            {
              username,
              usernameWithAt: `@${username}`,
            }
          )
          .orderBy("message.createdAt", "DESC")
          .limit(1)
          .getOne();

        const chatId = userMessage?.telegramChatId;

        // Получаем информацию о примененном промокоде, если есть
        let appliedPromocodeCode: string | null = null;
        if (order.appliedPromocodeId) {
          const promocode = await this.promocodeRepository.findOne({
            where: { id: order.appliedPromocodeId, botId },
            select: ["code"],
          });
          if (promocode) {
            appliedPromocodeCode = promocode.code;
          }
        }

        return {
          ...order,
          chatId,
          appliedPromocodeCode,
        };
      })
    );

    return ordersWithChatId;
  }

  /**
   * Обновить статус заказа (для админа)
   */
  async updateOrderStatus(
    botId: string,
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto
  ): Promise<Order> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем заказ
    const order = await this.orderRepository.findOne({
      where: { id: orderId, botId },
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    // Проверяем, можно ли изменить статус
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        "Нельзя изменить статус отмененного заказа"
      );
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        "Нельзя изменить статус доставленного заказа"
      );
    }

    const oldStatus = order.status;
    order.status = updateStatusDto.status;
    const savedOrder = await this.orderRepository.save(order);

    // Если статус изменился на CONFIRMED, резервируем товары (уменьшаем stockQuantity)
    if (
      oldStatus !== OrderStatus.CONFIRMED &&
      updateStatusDto.status === OrderStatus.CONFIRMED
    ) {
      await this.reserveProducts(botId, order.items);
    }

    // Если заказ отменен, возвращаем товары на склад
    if (updateStatusDto.status === OrderStatus.CANCELLED) {
      await this.returnProductsToStock(botId, order.items);
    }

    // Отправляем уведомление владельцу бота
    await this.sendOrderNotification(
      bot,
      NotificationType.ORDER_STATUS_UPDATED,
      savedOrder
    );

    this.logger.log(
      `Статус заказа ${orderId} изменен с ${oldStatus} на ${updateStatusDto.status}`
    );

    return savedOrder;
  }

  /**
   * Удалить заказ (для админа)
   */
  async deleteOrder(botId: string, orderId: string): Promise<void> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем заказ
    const order = await this.orderRepository.findOne({
      where: { id: orderId, botId },
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    // Если заказ был подтвержден, возвращаем товары на склад
    if (order.status === OrderStatus.CONFIRMED) {
      await this.returnProductsToStock(botId, order.items);
    }

    // Удаляем заказ
    await this.orderRepository.remove(order);

    this.logger.log(`Заказ ${orderId} удален`);
  }

  /**
   * Обновить данные покупателя заказа (для админа)
   */
  async updateOrderCustomerData(
    botId: string,
    orderId: string,
    customerData: Order["customerData"]
  ): Promise<Order> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем заказ
    const order = await this.orderRepository.findOne({
      where: { id: orderId, botId },
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    order.customerData = customerData;
    const savedOrder = await this.orderRepository.save(order);

    // Отправляем уведомление владельцу бота
    await this.sendOrderNotification(
      bot,
      NotificationType.ORDER_STATUS_UPDATED,
      savedOrder
    );

    this.logger.log(`Данные покупателя заказа ${orderId} обновлены`);

    return savedOrder;
  }

  /**
   * Резервировать товары (уменьшить stockQuantity)
   */
  private async reserveProducts(
    botId: string,
    items: Order["items"]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, botId },
      });

      if (product) {
        product.stockQuantity = Math.max(
          0,
          product.stockQuantity - item.quantity
        );
        await this.productRepository.save(product);
      }
    }
  }

  /**
   * Вернуть товары на склад (увеличить stockQuantity)
   */
  private async returnProductsToStock(
    botId: string,
    items: Order["items"]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, botId },
      });

      if (product) {
        product.stockQuantity += item.quantity;
        await this.productRepository.save(product);
      }
    }
  }

  /**
   * Отправить уведомление о заказе владельцу бота
   */
  private async sendOrderNotification(
    bot: Bot,
    type: NotificationType,
    order: Order
  ): Promise<void> {
    if (!bot.ownerId) {
      return;
    }

    try {
      await this.notificationService.sendToUser(bot.ownerId, type, {
        botId: bot.id,
        order: {
          id: order.id,
          telegramUsername: order.telegramUsername,
          items: order.items,
          customerData: order.customerData,
          additionalMessage: order.additionalMessage,
          status: order.status,
          totalPrice: order.totalPrice,
          currency: order.currency,
          totalItems: order.totalItems,
          createdAt: order.createdAt,
          appliedPromocodeId: order.appliedPromocodeId,
          promocodeDiscount: order.promocodeDiscount,
        },
      });
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления о заказе (${type}):`,
        error
      );
    }
  }
}
