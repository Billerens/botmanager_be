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
import { Cart, CartItem } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ShopPromocodesService } from "../shop-promocodes/shop-promocodes.service";

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
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ShopPromocodesService))
    private readonly shopPromocodesService: ShopPromocodesService
  ) {}

  /**
   * Получить корзину пользователя для бота
   */
  async getCart(botId: string, telegramUsername: string): Promise<Cart> {
    this.logger.log(
      `[CART SERVICE] getCart called - botId: ${botId}, telegramUsername: ${telegramUsername}`
    );

    // Проверяем существование бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      this.logger.warn(`[CART SERVICE] Bot not found - botId: ${botId}`);
      throw new NotFoundException("Бот не найден");
    }

    // Ищем существующую корзину или создаем новую
    let cart = await this.cartRepository.findOne({
      where: { botId, telegramUsername },
    });

    if (!cart) {
      this.logger.log(
        `[CART SERVICE] Creating new cart for botId: ${botId}, telegramUsername: ${telegramUsername}`
      );
      cart = this.cartRepository.create({
        botId,
        telegramUsername,
        items: [],
      });
      cart = await this.cartRepository.save(cart);

      // Отправляем уведомление о создании корзины
      await this.sendCartNotification(bot, NotificationType.CART_CREATED, cart);
    } else {
      this.logger.log(
        `[CART SERVICE] Cart found - cartId: ${cart.id}, items count: ${cart.items?.length || 0}, appliedPromocodeId: ${cart.appliedPromocodeId || "null"}`
      );
    }

    // Если есть примененный промокод, валидируем его и пересчитываем скидку
    if (cart.appliedPromocodeId) {
      this.logger.log(
        `[CART SERVICE] Cart has appliedPromocodeId: ${cart.appliedPromocodeId}, validating...`
      );
      try {
        const promocode = await this.promocodeRepository.findOne({
          where: { id: cart.appliedPromocodeId, botId },
        });

        if (promocode) {
          this.logger.log(
            `[CART SERVICE] Promocode found in validation - code: ${promocode.code}, isActive: ${promocode.isActive}`
          );

          // Валидируем промокод для текущей корзины
          const validation = await this.shopPromocodesService.validatePromocode(
            botId,
            promocode.code,
            cart
          );

          this.logger.log(
            `[CART SERVICE] Promocode validation in getCart - isValid: ${validation.isValid}, discount: ${validation.discount || "null"}`
          );

          // Если промокод стал недействителен, удаляем его
          if (!validation.isValid) {
            this.logger.warn(
              `[CART SERVICE] Promocode is invalid, removing from cart - code: ${promocode.code}`
            );
            cart.appliedPromocodeId = null;
            cart = await this.cartRepository.save(cart);
          }
        } else {
          this.logger.warn(
            `[CART SERVICE] Promocode not found with id: ${cart.appliedPromocodeId}, removing from cart`
          );
          // Промокод не найден, удаляем его из корзины
          cart.appliedPromocodeId = null;
          cart = await this.cartRepository.save(cart);
        }
      } catch (error) {
        this.logger.error(
          "Ошибка при валидации примененного промокода:",
          error
        );
        // В случае ошибки удаляем промокод
        cart.appliedPromocodeId = null;
        cart = await this.cartRepository.save(cart);
      }
    } else {
      this.logger.log(`[CART SERVICE] Cart has no appliedPromocodeId`);
    }

    this.logger.log(
      `[CART SERVICE] Returning cart - cartId: ${cart.id}, appliedPromocodeId: ${cart.appliedPromocodeId || "null"}`
    );
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
    cart.appliedPromocodeId = null; // Удаляем примененный промокод при очистке корзины
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

    // Получаем chatId и информацию о промокодах для каждой корзины
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

        // Получаем информацию о примененном промокоде
        const promocodeInfo = await this.getAppliedPromocodeInfo(botId, cart);

        return {
          ...cart,
          chatId,
          totalItems: cart.totalItems,
          totalPrice: cart.totalPrice,
          currency: cart.currency,
          appliedPromocode: promocodeInfo
            ? {
                code: promocodeInfo.promocode?.code,
                discount: promocodeInfo.discount,
              }
            : null,
        };
      })
    );

    return cartsWithChatId;
  }

  /**
   * Валидировать промокод для корзины
   */
  async validatePromocode(
    botId: string,
    telegramUsername: string,
    code: string
  ): Promise<{
    isValid: boolean;
    promocode?: any;
    discount?: number;
    message?: string;
  }> {
    const cart = await this.getCart(botId, telegramUsername);
    return this.shopPromocodesService.validatePromocode(botId, code, cart);
  }

  /**
   * Получить информацию о примененном промокоде и скидке
   */
  async getAppliedPromocodeInfo(
    botId: string,
    cart: Cart
  ): Promise<{
    promocode?: ShopPromocode;
    discount?: number;
  } | null> {
    this.logger.log(
      `[CART SERVICE] getAppliedPromocodeInfo called - botId: ${botId}, cartId: ${cart.id}, appliedPromocodeId: ${cart.appliedPromocodeId || "null"}`
    );

    if (!cart.appliedPromocodeId) {
      this.logger.log(
        `[CART SERVICE] No appliedPromocodeId in cart, returning null`
      );
      return null;
    }

    try {
      this.logger.log(
        `[CART SERVICE] Looking for promocode with id: ${cart.appliedPromocodeId}, botId: ${botId}`
      );

      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId, botId },
      });

      if (!promocode) {
        this.logger.warn(
          `[CART SERVICE] Promocode not found with id: ${cart.appliedPromocodeId}, botId: ${botId}`
        );
        return null;
      }

      this.logger.log(
        `[CART SERVICE] Promocode found - code: ${promocode.code}, type: ${promocode.type}, value: ${promocode.value}, isActive: ${promocode.isActive}`
      );

      // Валидируем промокод для текущей корзины
      this.logger.log(
        `[CART SERVICE] Validating promocode for cart - cart items count: ${cart.items?.length || 0}`
      );

      const validation = await this.shopPromocodesService.validatePromocode(
        botId,
        promocode.code,
        cart
      );

      this.logger.log(
        `[CART SERVICE] Validation result - isValid: ${validation.isValid}, discount: ${validation.discount || "null"}, message: ${validation.message || "null"}`
      );

      if (!validation.isValid || !validation.discount) {
        this.logger.warn(
          `[CART SERVICE] Promocode validation failed - isValid: ${validation.isValid}, discount: ${validation.discount || "null"}`
        );
        return null;
      }

      const result = {
        promocode,
        discount: validation.discount,
      };

      this.logger.log(
        `[CART SERVICE] Returning promocode info - code: ${result.promocode.code}, discount: ${result.discount}`
      );

      return result;
    } catch (error) {
      this.logger.error(
        "Ошибка при получении информации о примененном промокоде:",
        error
      );
      return null;
    }
  }

  /**
   * Применить промокод к корзине
   */
  async applyPromocode(
    botId: string,
    telegramUsername: string,
    code: string
  ): Promise<Cart> {
    const cart = await this.getCart(botId, telegramUsername);

    // Валидируем промокод
    const validation = await this.shopPromocodesService.validatePromocode(
      botId,
      code,
      cart
    );

    if (!validation.isValid || !validation.promocode) {
      throw new BadRequestException(
        validation.message || "Промокод недействителен"
      );
    }

    // Применяем промокод
    cart.appliedPromocodeId = validation.promocode.id;
    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_UPDATED,
        savedCart
      );

      // Отправляем уведомление об использовании промокода
      if (bot.ownerId) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.SHOP_PROMOCODE_USED, {
            botId,
            promocode: {
              id: validation.promocode.id,
              code: validation.promocode.code,
              type: validation.promocode.type,
              value: validation.promocode.value,
              discount: validation.discount,
            },
            cart: {
              telegramUsername: telegramUsername,
              totalPrice: savedCart.totalPrice,
            },
          })
          .catch((error) => {
            this.logger.error(
              "Ошибка отправки уведомления об использовании промокода:",
              error
            );
          });
      }
    }

    return savedCart;
  }

  /**
   * Удалить промокод из корзины
   */
  async removePromocode(
    botId: string,
    telegramUsername: string
  ): Promise<Cart> {
    const cart = await this.getCart(botId, telegramUsername);

    // Получаем данные промокода перед удалением
    let promocodeData = null;
    if (cart.appliedPromocodeId) {
      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId, botId },
      });
      if (promocode) {
        promocodeData = {
          id: promocode.id,
          code: promocode.code,
          type: promocode.type,
          value: promocode.value,
        };
      }
    }

    cart.appliedPromocodeId = null;
    const savedCart = await this.cartRepository.save(cart);

    // Отправляем уведомление
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });
    if (bot) {
      await this.sendCartNotification(
        bot,
        NotificationType.CART_UPDATED,
        savedCart
      );

      // Отправляем уведомление об отвязке промокода
      if (bot.ownerId && promocodeData) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.SHOP_PROMOCODE_UNLINKED, {
            botId,
            promocode: promocodeData,
            cart: {
              telegramUsername: telegramUsername,
              totalPrice: savedCart.totalPrice,
            },
          })
          .catch((error) => {
            this.logger.error(
              "Ошибка отправки уведомления об отвязке промокода:",
              error
            );
          });
      }
    }

    return savedCart;
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
