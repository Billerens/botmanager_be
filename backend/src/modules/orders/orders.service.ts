import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OnEvent } from "@nestjs/event-emitter";
import { Order, OrderStatus } from "../../database/entities/order.entity";
import { Cart, CartItem } from "../../database/entities/cart.entity";
import { Shop } from "../../database/entities/shop.entity";
import {
  Product,
  ProductVariation,
  applyProductDiscount,
} from "../../database/entities/product.entity";
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  UpdateOrderItemsDto,
  OrderItemUpdateEntryDto,
} from "./dto/order.dto";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocodesService } from "../shop-promocodes/shop-promocodes.service";
import { CartService } from "../cart/cart.service";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { PaymentConfigService } from "../payments/services/payment-config.service";
import { PaymentEntityType } from "../../database/entities/payment-config.entity";
import {
  Payment,
  EntityPaymentStatus,
  PaymentTargetType,
} from "../../database/entities/payment.entity";
import { PaymentEvent } from "../payments/services/payment-transaction.service";
import { ShopPermissionsService } from "../shops/shop-permissions.service";

/**
 * Идентификатор пользователя для заказов
 */
export interface OrderUserIdentifier {
  telegramUsername?: string;
  publicUserId?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
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
    private readonly cartService: CartService,
    private readonly activityLogService: ActivityLogService,
    @Inject(forwardRef(() => PaymentConfigService))
    private readonly paymentConfigService: PaymentConfigService,
    private readonly shopPermissionsService: ShopPermissionsService
  ) {}

  // =====================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ ПЛАТЕЖЕЙ
  // =====================================================

  /**
   * Обработка события успешного платежа
   */
  @OnEvent(PaymentEvent.SUCCEEDED)
  async handlePaymentSucceeded(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.ORDER) {
      return;
    }

    this.logger.log(`Payment succeeded for order ${payment.targetId}`);

    try {
      const order = await this.orderRepository.findOne({
        where: { id: payment.targetId },
      });

      if (!order) {
        this.logger.warn(`Order ${payment.targetId} not found for payment`);
        return;
      }

      // Обновляем статус оплаты
      order.paymentId = payment.id;
      order.paymentStatus = EntityPaymentStatus.PAID;

      // Автоматически подтверждаем заказ при успешной оплате
      if (order.status === OrderStatus.PENDING) {
        order.status = OrderStatus.CONFIRMED;
      }

      await this.orderRepository.save(order);

      this.logger.log(`Order ${order.id} payment status updated to PAID`);
    } catch (error) {
      this.logger.error(
        `Error handling payment succeeded for order ${payment.targetId}`,
        error
      );
    }
  }

  /**
   * Обработка события неудачного платежа
   */
  @OnEvent(PaymentEvent.FAILED)
  async handlePaymentFailed(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.ORDER) {
      return;
    }

    this.logger.log(`Payment failed for order ${payment.targetId}`);

    try {
      await this.orderRepository.update(payment.targetId, {
        paymentId: payment.id,
        paymentStatus: EntityPaymentStatus.FAILED,
      });
    } catch (error) {
      this.logger.error(
        `Error handling payment failed for order ${payment.targetId}`,
        error
      );
    }
  }

  /**
   * Обработка события возврата платежа
   */
  @OnEvent(PaymentEvent.REFUNDED)
  async handlePaymentRefunded(payment: Payment): Promise<void> {
    if (payment.targetType !== PaymentTargetType.ORDER) {
      return;
    }

    this.logger.log(`Payment refunded for order ${payment.targetId}`);

    try {
      await this.orderRepository.update(payment.targetId, {
        paymentStatus: payment.isFullyRefunded
          ? EntityPaymentStatus.REFUNDED
          : EntityPaymentStatus.PARTIALLY_REFUNDED,
      });
    } catch (error) {
      this.logger.error(
        `Error handling payment refunded for order ${payment.targetId}`,
        error
      );
    }
  }

  // =====================================================
  // ОСНОВНЫЕ МЕТОДЫ (работают с shopId)
  // Legacy методы с botId удалены
  // =====================================================

  /**
   * Валидация владения магазином
   */
  private async validateShopOwnership(
    shopId: string,
    userId: string
  ): Promise<Shop> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    if (shop.ownerId === userId) {
      return shop;
    }
    const hasAccess = await this.shopPermissionsService.hasAccessToShop(
      userId,
      shopId
    );
    if (!hasAccess) {
      throw new ForbiddenException("Нет доступа к этому магазину");
    }
    return shop;
  }

  /**
   * Создать заказ из корзины
   */
  async createOrder(
    shopId: string,
    user: OrderUserIdentifier,
    createOrderDto: CreateOrderDto
  ): Promise<Order> {
    const { telegramUsername, publicUserId } = user;

    // Проверяем существование магазина
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    // Получаем корзину пользователя
    let cart: Cart | null = null;
    if (telegramUsername) {
      cart = await this.cartRepository.findOne({
        where: { shopId, telegramUsername },
      });
    } else if (publicUserId) {
      cart = await this.cartRepository.findOne({
        where: { shopId, publicUserId },
      });
    }

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException("Корзина пуста");
    }

    // Проверяем наличие товаров
    for (const item of cart.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, shopId },
      });

      if (!product) {
        throw new NotFoundException(`Товар с ID ${item.productId} не найден`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Товар "${product.name}" неактивен`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Недостаточно товара "${product.name}" в наличии. Доступно: ${product.stockQuantity}`
        );
      }
    }

    // Рассчитываем скидку промокода, если применен
    let promocodeDiscount = 0;
    let appliedPromocodeId = null;

    if (cart.appliedPromocodeId) {
      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId },
      });

      if (promocode) {
        const validation = await this.shopPromocodesService.validatePromocode(
          shopId,
          promocode.code,
          cart
        );

        if (validation.isValid && validation.discount) {
          promocodeDiscount = validation.discount;
          appliedPromocodeId = cart.appliedPromocodeId;

          // Увеличиваем счетчик использований промокода
          await this.shopPromocodesService.incrementUsageCount(
            cart.appliedPromocodeId
          );
        }
      }
    }

    // Проверяем настройки платежей для магазина
    let paymentRequired = false;
    let paymentStatus = EntityPaymentStatus.NOT_REQUIRED;

    try {
      const paymentEnabled = await this.paymentConfigService.isPaymentEnabled(
        PaymentEntityType.SHOP,
        shopId
      );
      if (paymentEnabled) {
        paymentRequired = true;
        paymentStatus = EntityPaymentStatus.PENDING;
      }
    } catch (error) {
      // Если не удалось проверить настройки платежей, продолжаем без требования оплаты
      this.logger.warn(
        `Failed to check payment config for shop ${shopId}: ${error.message}`
      );
    }

    // Рассчитываем сумму к оплате
    const totalOrderPrice = cart.totalPrice - promocodeDiscount;

    // Создаем заказ
    const order = this.orderRepository.create({
      shopId,
      telegramUsername: telegramUsername || null,
      publicUserId: publicUserId || null,
      items: cart.items,
      totalPrice: totalOrderPrice,
      currency: cart.currency,
      status: OrderStatus.PENDING,
      customerData: createOrderDto.customerData,
      additionalMessage: createOrderDto.additionalMessage,
      appliedPromocodeId,
      promocodeDiscount: promocodeDiscount > 0 ? promocodeDiscount : null,
      // Платёжные поля
      paymentRequired,
      paymentStatus,
      paymentAmount: paymentRequired ? totalOrderPrice : null,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Списываем товары со склада
    await this.reduceProductStock(shopId, cart.items);

    // Очищаем корзину
    cart.items = [];
    cart.appliedPromocodeId = null;
    await this.cartRepository.save(cart);

    // Уведомление владельцу магазина
    if (shop.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.ORDER_CREATED, {
          shopId,
          order: {
            id: savedOrder.id,
            telegramUsername: savedOrder.telegramUsername,
            publicUserId: savedOrder.publicUserId,
            items: savedOrder.items,
            customerData: savedOrder.customerData,
            status: savedOrder.status,
            totalPrice: savedOrder.totalPrice,
            currency: savedOrder.currency,
            totalItems: savedOrder.totalItems,
            createdAt: savedOrder.createdAt,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления о создании заказа:",
            error
          );
        });

      // Логирование
      this.activityLogService
        .create({
          type: ActivityType.ORDER_CREATED,
          level: ActivityLevel.SUCCESS,
          message: `Создан заказ #${savedOrder.id.slice(-6)}`,
          userId: shop.ownerId,
          metadata: {
            shopId,
            orderId: savedOrder.id,
            totalPrice: savedOrder.totalPrice,
            itemsCount: savedOrder.totalItems,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования создания заказа:", error);
        });
    }

    return savedOrder;
  }

  /**
   * Получить заказы магазина (для админа)
   */
  async findAll(
    shopId: string,
    userId: string,
    filters?: {
      status?: OrderStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    await this.validateShopOwnership(shopId, userId);

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .where("order.shopId = :shopId", { shopId })
      .skip(skip)
      .take(limit)
      .orderBy("order.createdAt", "DESC");

    if (filters?.status) {
      queryBuilder.andWhere("order.status = :status", {
        status: filters.status,
      });
    }

    if (filters?.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      queryBuilder.andWhere(
        "(LOWER(order.telegramUsername) LIKE :search OR LOWER(order.publicUserId) LIKE :search)",
        { search: `%${searchLower}%` }
      );
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить заказ по ID (для админа)
   */
  async findOne(id: string, shopId: string, userId: string): Promise<Order> {
    await this.validateShopOwnership(shopId, userId);

    const order = await this.orderRepository.findOne({
      where: { id, shopId },
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    return order;
  }

  /**
   * Обновить статус заказа
   */
  async updateStatus(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateOrderStatusDto
  ): Promise<Order> {
    const shop = await this.validateShopOwnership(shopId, userId);
    const order = await this.findOne(id, shopId, userId);

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

    // Проверяем оплату при переходе к статусам, требующим оплаты
    const statusesRequiringPayment = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (
      order.paymentRequired &&
      statusesRequiringPayment.includes(updateDto.status) &&
      order.paymentStatus !== EntityPaymentStatus.PAID
    ) {
      throw new BadRequestException(
        "Невозможно изменить статус заказа без оплаты. Текущий статус оплаты: " +
          order.paymentStatus
      );
    }

    const oldStatus = order.status;
    order.status = updateDto.status;

    const updatedOrder = await this.orderRepository.save(order);

    // Если заказ отменен, возвращаем товары на склад
    // Примечание: oldStatus не может быть CANCELLED, так как это уже проверено выше
    if (updateDto.status === OrderStatus.CANCELLED) {
      await this.returnProductsToStock(shopId, order.items);
    }

    // Уведомление
    if (shop.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.ORDER_STATUS_UPDATED, {
          shopId,
          order: {
            id: updatedOrder.id,
            status: updatedOrder.status,
            oldStatus,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления об изменении статуса заказа:",
            error
          );
        });

      // Логирование
      this.activityLogService
        .create({
          type: ActivityType.ORDER_UPDATED,
          level: ActivityLevel.INFO,
          message: `Статус заказа #${order.id.slice(-6)} изменен: ${oldStatus} → ${updateDto.status}`,
          userId,
          metadata: {
            shopId,
            orderId: order.id,
            oldStatus,
            newStatus: updateDto.status,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка логирования изменения статуса заказа:",
            error
          );
        });
    }

    return updatedOrder;
  }

  /**
   * Удалить заказ
   */
  async remove(id: string, shopId: string, userId: string): Promise<void> {
    const shop = await this.validateShopOwnership(shopId, userId);
    const order = await this.findOne(id, shopId, userId);

    // Если заказ был подтвержден, возвращаем товары на склад
    if (
      order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.PROCESSING ||
      order.status === OrderStatus.SHIPPED
    ) {
      await this.returnProductsToStock(shopId, order.items);
    }

    await this.orderRepository.remove(order);

    this.logger.log(`Заказ ${id} удален`);

    // Логирование
    if (shop.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.ORDER_DELETED,
          level: ActivityLevel.WARNING,
          message: `Удален заказ #${id.slice(-6)}`,
          userId,
          metadata: {
            shopId,
            orderId: id,
            orderStatus: order.status,
            totalPrice: order.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования удаления заказа:", error);
        });
    }
  }

  /**
   * Обновить данные покупателя заказа
   */
  async updateCustomerData(
    id: string,
    shopId: string,
    userId: string,
    customerData: Order["customerData"]
  ): Promise<Order> {
    const shop = await this.validateShopOwnership(shopId, userId);
    const order = await this.findOne(id, shopId, userId);

    order.customerData = customerData;
    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(`Данные покупателя заказа ${id} обновлены`);

    // Логирование
    if (shop.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.ORDER_UPDATED,
          level: ActivityLevel.INFO,
          message: `Обновлены данные покупателя заказа #${id.slice(-6)}`,
          userId,
          metadata: {
            shopId,
            orderId: id,
            customerData,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка логирования обновления данных клиента:",
            error
          );
        });
    }

    return savedOrder;
  }

  /**
   * Обновить состав заказа (позиции и количество).
   * Возвращает старые товары на склад и списывает новые. Пересчитывает totalPrice.
   */
  async updateOrderItems(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateOrderItemsDto
  ): Promise<Order> {
    const shop = await this.validateShopOwnership(shopId, userId);
    const order = await this.findOne(id, shopId, userId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        "Нельзя изменить состав отменённого заказа"
      );
    }
    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        "Нельзя изменить состав доставленного заказа"
      );
    }

    if (!updateDto.items || updateDto.items.length === 0) {
      throw new BadRequestException("Состав заказа не может быть пустым");
    }

    const oldItems = order.items || [];
    const newEntries = updateDto.items;

    const newQtyByProduct = new Map<string, number>();
    for (const entry of newEntries) {
      newQtyByProduct.set(
        entry.productId,
        (newQtyByProduct.get(entry.productId) || 0) + entry.quantity
      );
    }

    const oldQtyByProduct = new Map<string, number>();
    for (const item of oldItems) {
      oldQtyByProduct.set(
        item.productId,
        (oldQtyByProduct.get(item.productId) || 0) + item.quantity
      );
    }

    const newCartItems: CartItem[] = [];
    const currency = order.currency;

    for (const entry of newEntries) {
      const product = await this.productRepository.findOne({
        where: { id: entry.productId, shopId },
      });
      if (!product) {
        throw new NotFoundException(
          `Товар с ID ${entry.productId} не найден`
        );
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Товар "${product.name}" неактивен`
        );
      }

      const effectiveStock =
        product.stockQuantity +
        (oldQtyByProduct.get(entry.productId) || 0);
      const requiredTotal = newQtyByProduct.get(entry.productId) || 0;
      if (effectiveStock < requiredTotal) {
        throw new BadRequestException(
          `Недостаточно товара "${product.name}" в наличии. Доступно с учётом текущего заказа: ${effectiveStock}, запрошено: ${requiredTotal}`
        );
      }

      let priceBeforeDiscount = Number(product.price);
      let variationLabel: string | undefined;
      if (entry.variationId && product.variations?.length) {
        const variation = product.variations.find(
          (v: ProductVariation) => v.id === entry.variationId
        );
        if (variation) {
          variationLabel = variation.label;
          if (variation.priceType === "fixed") {
            priceBeforeDiscount = Number(variation.priceModifier);
          } else {
            priceBeforeDiscount =
              Number(product.price) + Number(variation.priceModifier);
          }
        }
      }
      const price = applyProductDiscount(
        priceBeforeDiscount,
        product.discount ?? undefined
      );

      newCartItems.push({
        productId: product.id,
        quantity: entry.quantity,
        price,
        currency: product.currency || currency,
        name: product.name,
        image:
          Array.isArray(product.images) && product.images.length > 0
            ? product.images[0]
            : undefined,
        variationId: entry.variationId,
        variationLabel,
      });
    }

    await this.returnProductsToStock(shopId, oldItems);
    const subtotal = newCartItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
    const discount = Number(order.promocodeDiscount) || 0;
    order.items = newCartItems;
    order.totalPrice = Math.max(0, subtotal - discount);

    await this.reduceProductStock(shopId, newCartItems);
    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(`Состав заказа ${id} обновлён`);

    if (shop.ownerId) {
      this.activityLogService
        .create({
          type: ActivityType.ORDER_UPDATED,
          level: ActivityLevel.INFO,
          message: `Обновлён состав заказа #${id.slice(-6)}`,
          userId,
          metadata: { shopId, orderId: id, itemsCount: newCartItems.length },
        })
        .catch((err) =>
          this.logger.error("Ошибка логирования обновления состава заказа", err)
        );
    }

    return savedOrder;
  }

  // =====================================================
  // ПУБЛИЧНЫЕ МЕТОДЫ (для покупателей)
  // =====================================================

  /**
   * Получить заказы пользователя
   */
  async getUserOrders(
    shopId: string,
    user: OrderUserIdentifier,
    filters?: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
    }
  ) {
    const { telegramUsername, publicUserId } = user;

    // Проверяем существование магазина
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .where("order.shopId = :shopId", { shopId })
      .skip(skip)
      .take(limit)
      .orderBy("order.createdAt", "DESC");

    if (telegramUsername) {
      queryBuilder.andWhere("order.telegramUsername = :telegramUsername", {
        telegramUsername,
      });
    } else if (publicUserId) {
      queryBuilder.andWhere("order.publicUserId = :publicUserId", {
        publicUserId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere("order.status = :status", {
        status: filters.status,
      });
    }

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить заказ по ID (для покупателя)
   */
  async getUserOrder(
    shopId: string,
    orderId: string,
    user: OrderUserIdentifier
  ): Promise<Order> {
    const { telegramUsername, publicUserId } = user;

    const whereClause: any = { id: orderId, shopId };
    if (telegramUsername) {
      whereClause.telegramUsername = telegramUsername;
    } else if (publicUserId) {
      whereClause.publicUserId = publicUserId;
    }

    const order = await this.orderRepository.findOne({
      where: whereClause,
    });

    if (!order) {
      throw new NotFoundException("Заказ не найден");
    }

    return order;
  }

  // =====================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // =====================================================

  /**
   * Списать товары со склада
   */
  private async reduceProductStock(
    shopId: string,
    items: Order["items"]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, shopId },
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
   * Вернуть товары на склад
   */
  private async returnProductsToStock(
    shopId: string,
    items: Order["items"]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, shopId },
      });

      if (product) {
        product.stockQuantity += item.quantity;
        await this.productRepository.save(product);
      }
    }
  }

  // =====================================================
  // ALIAS МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С ShopsController
  // =====================================================

  async createOrderByShop(
    shopId: string,
    user: OrderUserIdentifier,
    createOrderDto: CreateOrderDto
  ): Promise<Order> {
    return this.createOrder(shopId, user, createOrderDto);
  }

  async getOrdersByShop(
    shopId: string,
    userId: string,
    filters?: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
    }
  ) {
    return this.findAll(shopId, userId, filters);
  }

  async getOrderByShop(
    id: string,
    shopId: string,
    userId: string
  ): Promise<Order> {
    return this.findOne(id, shopId, userId);
  }

  async updateOrderStatusByShop(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateOrderStatusDto
  ): Promise<Order> {
    return this.updateStatus(id, shopId, userId, updateDto);
  }

  async updateOrderItemsByShop(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateOrderItemsDto
  ): Promise<Order> {
    return this.updateOrderItems(id, shopId, userId, updateDto);
  }

  async getUserOrdersByShop(
    shopId: string,
    user: OrderUserIdentifier,
    filters?: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
    }
  ) {
    return this.getUserOrders(shopId, user, filters);
  }
}
