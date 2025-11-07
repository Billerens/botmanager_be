import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Cart, CartItem } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Message } from "../../database/entities/message.entity";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Получить корзину пользователя для бота
   */
  async getCart(botId: string, telegramUsername: string): Promise<Cart> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Ищем существующую корзину или создаем новую
    let cart = await this.cartRepository.findOne({
      where: { botId, telegramUsername },
    });

    if (!cart) {
      cart = this.cartRepository.create({
        botId,
        telegramUsername,
        items: [],
      });
      cart = await this.cartRepository.save(cart);

      // Отправляем уведомление о создании корзины
      await this.sendCartNotification(bot, NotificationType.CART_CREATED, cart);
    }

    return cart;
  }

  /**
   * Добавить товар в корзину
   */
  async addItem(
    botId: string,
    telegramUsername: string,
    productId: string,
    quantity: number = 1
  ): Promise<Cart> {
    if (quantity <= 0) {
      throw new BadRequestException("Количество должно быть больше 0");
    }

    // Проверяем существование продукта
    const product = await this.productRepository.findOne({
      where: { id: productId, botId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (!product.isActive) {
      throw new BadRequestException("Товар неактивен");
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    // Получаем корзину
    let cart = await this.getCart(botId, telegramUsername);

    // Проверяем, есть ли уже этот товар в корзине
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (existingItemIndex >= 0) {
      // Обновляем количество существующего товара
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      if (product.stockQuantity < newQuantity) {
        throw new BadRequestException(
          `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}, в корзине: ${cart.items[existingItemIndex].quantity}`
        );
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Добавляем новый товар
      const cartItem: CartItem = {
        productId: product.id,
        quantity,
        price: Number(product.price),
        currency: product.currency,
        name: product.name,
        image:
          product.images && product.images.length > 0
            ? product.images[0]
            : undefined,
      };

      cart.items.push(cartItem);
    }

    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление о добавлении товара в корзину
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_ITEM_ADDED,
        savedCart
      );
    }

    return savedCart;
  }

  /**
   * Обновить количество товара в корзине
   */
  async updateItem(
    botId: string,
    telegramUsername: string,
    productId: string,
    quantity: number
  ): Promise<Cart> {
    if (quantity <= 0) {
      throw new BadRequestException("Количество должно быть больше 0");
    }

    // Проверяем существование продукта
    const product = await this.productRepository.findOne({
      where: { id: productId, botId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    // Получаем корзину
    const cart = await this.getCart(botId, telegramUsername);

    // Находим товар в корзине
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (itemIndex < 0) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    // Обновляем количество
    cart.items[itemIndex].quantity = quantity;

    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление об обновлении корзины
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_UPDATED,
        savedCart
      );
    }

    return savedCart;
  }

  /**
   * Удалить товар из корзины
   */
  async removeItem(
    botId: string,
    telegramUsername: string,
    productId: string
  ): Promise<Cart> {
    const cart = await this.getCart(botId, telegramUsername);

    // Удаляем товар из корзины
    cart.items = cart.items.filter((item) => item.productId !== productId);

    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление об удалении товара из корзины
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_ITEM_REMOVED,
        savedCart
      );
    }

    return savedCart;
  }

  /**
   * Очистить корзину
   */
  async clearCart(botId: string, telegramUsername: string): Promise<Cart> {
    const cart = await this.getCart(botId, telegramUsername);
    cart.items = [];
    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление об очистке корзины
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_CLEARED,
        savedCart
      );
    }

    return savedCart;
  }

  /**
   * Обновить количество товара в корзине (для админа)
   */
  async updateCartItemByAdmin(
    botId: string,
    cartId: string,
    productId: string,
    quantity: number
  ): Promise<Cart> {
    if (quantity <= 0) {
      throw new BadRequestException("Количество должно быть больше 0");
    }

    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем корзину
    const cart = await this.cartRepository.findOne({
      where: { id: cartId, botId },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    // Проверяем существование продукта
    const product = await this.productRepository.findOne({
      where: { id: productId, botId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    // Находим товар в корзине
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (itemIndex < 0) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    // Обновляем количество
    cart.items[itemIndex].quantity = quantity;

    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление об обновлении корзины
    await this.sendCartNotification(
      bot,
      NotificationType.CART_UPDATED,
      savedCart
    );

    return savedCart;
  }

  /**
   * Удалить товар из корзины (для админа)
   */
  async removeCartItemByAdmin(
    botId: string,
    cartId: string,
    productId: string
  ): Promise<Cart> {
    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Получаем корзину
    const cart = await this.cartRepository.findOne({
      where: { id: cartId, botId },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    // Проверяем, есть ли товар в корзине
    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId
    );

    if (itemIndex < 0) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    // Удаляем товар из корзины
    cart.items = cart.items.filter((item) => item.productId !== productId);

    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление об удалении товара из корзины
    await this.sendCartNotification(
      bot,
      NotificationType.CART_ITEM_REMOVED,
      savedCart
    );

    return savedCart;
  }

  /**
   * Получить все корзины бота (для админа)
   */
  async getCartsByBotId(
    botId: string,
    hideEmpty: boolean = false
  ): Promise<
    Array<
      Cart & {
        chatId?: string;
        totalItems: number;
        totalPrice: number;
        currency: string;
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

    // Получаем все корзины бота
    let carts = await this.cartRepository.find({
      where: { botId },
      order: { updatedAt: "DESC" },
    });

    // Фильтруем пустые корзины, если нужно
    if (hideEmpty) {
      carts = carts.filter((cart) => cart.items && cart.items.length > 0);
    }

    // Получаем chatId для каждой корзины из сообщений пользователя
    const cartsWithChatId = await Promise.all(
      carts.map(async (cart) => {
        // Пытаемся найти chatId по telegramUsername через метаданные сообщений
        const username = cart.telegramUsername.replace("@", "");
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

        return {
          ...cart,
          chatId,
          totalItems: cart.totalItems,
          totalPrice: cart.totalPrice,
          currency: cart.currency,
        };
      })
    );

    return cartsWithChatId;
  }

  /**
   * Отправить уведомление о корзине владельцу бота
   */
  private async sendCartNotification(
    bot: Bot,
    type: NotificationType,
    cart: Cart
  ): Promise<void> {
    if (!bot.ownerId) {
      return;
    }

    try {
      await this.notificationService.sendToUser(bot.ownerId, type, {
        botId: bot.id,
        cart: {
          id: cart.id,
          telegramUsername: cart.telegramUsername,
          items: cart.items,
          totalItems: cart.totalItems,
          totalPrice: cart.totalPrice,
          currency: cart.currency,
        },
      });
    } catch (error) {
      this.logger.error(
        `Ошибка отправки уведомления о корзине (${type}):`,
        error
      );
    }
  }
}
