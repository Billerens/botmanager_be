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
import {
  Product,
  ProductVariation,
  applyProductDiscount,
} from "../../database/entities/product.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ShopPromocodesService } from "../shop-promocodes/shop-promocodes.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { PaymentConfigService } from "../payments/services/payment-config.service";

/**
 * Идентификатор пользователя для корзины
 * Поддерживает Telegram (telegramUsername) или браузер (publicUserId)
 */
export interface CartUserIdentifier {
  telegramUsername?: string;
  publicUserId?: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ShopPromocodesService))
    private readonly shopPromocodesService: ShopPromocodesService,
    private readonly activityLogService: ActivityLogService,
    private readonly paymentConfigService: PaymentConfigService
  ) {}

  // =====================================================
  // ОСНОВНЫЕ МЕТОДЫ (работают с shopId)
  // Legacy методы с botId удалены
  // =====================================================

  /**
   * Получить корзину пользователя для магазина
   */
  async getCart(shopId: string, user: CartUserIdentifier): Promise<Cart> {
    const { telegramUsername, publicUserId } = user;

    this.logger.log(
      `[CART SERVICE] getCart called - shopId: ${shopId}, telegramUsername: ${telegramUsername || "null"}, publicUserId: ${publicUserId || "null"}`
    );

    // Проверяем существование магазина
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      this.logger.warn(`[CART SERVICE] Shop not found - shopId: ${shopId}`);
      throw new NotFoundException("Магазин не найден");
    }

    // Ищем существующую корзину
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
      this.logger.log(`[CART SERVICE] Creating new cart for shopId: ${shopId}`);
      cart = this.cartRepository.create({
        shopId,
        telegramUsername: telegramUsername || null,
        publicUserId: publicUserId || null,
        items: [],
      });
      cart = await this.cartRepository.save(cart);

      // Уведомление владельцу
      if (shop.ownerId) {
        this.notificationService
          .sendToUser(shop.ownerId, NotificationType.CART_CREATED, {
            shopId,
            cart: {
              id: cart.id,
              telegramUsername: cart.telegramUsername,
              publicUserId: cart.publicUserId,
            },
          })
          .catch((error) => {
            this.logger.error(
              "Ошибка отправки уведомления о создании корзины:",
              error
            );
          });
      }
    } else {
      this.logger.log(
        `[CART SERVICE] Cart found - cartId: ${cart.id}, items count: ${cart.items?.length || 0}`
      );
    }

    // Валидация промокода
    cart = await this.validateAppliedPromocode(shopId, cart);

    return cart;
  }

  /**
   * Валидация примененного промокода
   */
  private async validateAppliedPromocode(
    shopId: string,
    cart: Cart
  ): Promise<Cart> {
    if (!cart.appliedPromocodeId) {
      return cart;
    }

    this.logger.log(
      `[CART SERVICE] Validating promocode: ${cart.appliedPromocodeId}`
    );

    try {
      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId, shopId },
      });

      if (promocode) {
        const validation = await this.shopPromocodesService.validatePromocode(
          shopId,
          promocode.code,
          cart
        );

        if (!validation.isValid) {
          this.logger.warn(
            `[CART SERVICE] Promocode invalid, removing - code: ${promocode.code}`
          );
          cart.appliedPromocodeId = null;
          cart = await this.cartRepository.save(cart);
        }
      } else {
        this.logger.warn(
          `[CART SERVICE] Promocode not found: ${cart.appliedPromocodeId}`
        );
        cart.appliedPromocodeId = null;
        cart = await this.cartRepository.save(cart);
      }
    } catch (error) {
      this.logger.error("Ошибка при валидации промокода:", error);
      cart.appliedPromocodeId = null;
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  /**
   * Рассчитать цену товара с учётом вариации
   */
  private getItemPrice(
    product: Product,
    variationId?: string
  ): { price: number; variationLabel?: string } {
    const basePrice = Number(product.price);
    let priceBeforeDiscount: number;
    let variationLabel: string | undefined;
    if (!variationId || !product.variations?.length) {
      priceBeforeDiscount = basePrice;
    } else {
      const variation = product.variations.find(
        (v: ProductVariation) => v.id === variationId
      );
      if (!variation) {
        throw new BadRequestException("Вариация не найдена");
      }
      if (variation.isActive === false) {
        throw new BadRequestException("Вариация неактивна");
      }
      priceBeforeDiscount =
        variation.priceType === "fixed"
          ? variation.priceModifier
          : basePrice + variation.priceModifier;
      variationLabel = variation.label;
    }
    const price = applyProductDiscount(
      priceBeforeDiscount,
      product.discount ?? undefined
    );
    return { price, variationLabel };
  }

  /**
   * Добавить товар в корзину
   */
  async addItem(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    quantity: number = 1,
    variationId?: string
  ): Promise<Cart> {
    if (quantity <= 0) {
      throw new BadRequestException("Количество должно быть больше 0");
    }

    const product = await this.productRepository.findOne({
      where: { id: productId, shopId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (!product.isActive) {
      throw new BadRequestException("Товар неактивен");
    }

    const hasVariations =
      product.variations && product.variations.length > 0;
    if (hasVariations && !product.allowBaseOption && !variationId) {
      throw new BadRequestException(
        "Необходимо выбрать вариацию товара"
      );
    }
    if (variationId && !hasVariations) {
      throw new BadRequestException("У товара нет вариаций");
    }

    const { price, variationLabel } = this.getItemPrice(product, variationId);

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    let cart = await this.getCart(shopId, user);

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        (item.variationId ?? null) === (variationId ?? null)
    );

    if (existingItemIndex >= 0) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      if (product.stockQuantity < newQuantity) {
        throw new BadRequestException(
          `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}, в корзине: ${cart.items[existingItemIndex].quantity}`
        );
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      const displayName =
        variationLabel ? `${product.name} (${variationLabel})` : product.name;
      const currency = await this.paymentConfigService.getEffectiveShopCurrency(
        shopId
      );
      const cartItem: CartItem = {
        productId: product.id,
        quantity,
        price,
        currency,
        name: displayName,
        image:
          product.images && product.images.length > 0
            ? product.images[0]
            : undefined,
        variationId: variationId || undefined,
        variationLabel: variationLabel || undefined,
      };

      cart.items.push(cartItem);
    }

    const savedCart = await this.cartRepository.save(cart);

    // Уведомление
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_ITEM_ADDED, {
          shopId,
          cart: {
            id: savedCart.id,
            items: savedCart.items,
            totalItems: savedCart.totalItems,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления о добавлении товара:",
            error
          );
        });
    }

    return savedCart;
  }

  /**
   * Обновить количество товара в корзине
   */
  async updateItem(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    quantity: number,
    variationId?: string
  ): Promise<Cart> {
    if (quantity < 0) {
      throw new BadRequestException("Количество не может быть отрицательным");
    }

    if (quantity === 0) {
      return this.removeItem(shopId, user, productId, variationId);
    }

    const product = await this.productRepository.findOne({
      where: { id: productId, shopId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    const cart = await this.getCart(shopId, user);
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        (item.variationId ?? null) === (variationId ?? null)
    );

    if (itemIndex === -1) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    cart.items[itemIndex].quantity = quantity;
    const savedCart = await this.cartRepository.save(cart);

    // Уведомление
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_UPDATED, {
          shopId,
          cart: {
            id: savedCart.id,
            items: savedCart.items,
            totalItems: savedCart.totalItems,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления об обновлении:",
            error
          );
        });
    }

    return savedCart;
  }

  /**
   * Удалить товар из корзины
   */
  async removeItem(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    variationId?: string
  ): Promise<Cart> {
    const cart = await this.getCart(shopId, user);
    cart.items = cart.items.filter(
      (item) =>
        !(
          item.productId === productId &&
          (item.variationId ?? null) === (variationId ?? null)
        )
    );
    const savedCart = await this.cartRepository.save(cart);

    // Уведомление
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_ITEM_REMOVED, {
          shopId,
          cart: {
            id: savedCart.id,
            items: savedCart.items,
            totalItems: savedCart.totalItems,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка отправки уведомления об удалении:", error);
        });
    }

    return savedCart;
  }

  /**
   * Очистить корзину
   */
  async clearCart(shopId: string, user: CartUserIdentifier): Promise<Cart> {
    const cart = await this.getCart(shopId, user);
    cart.items = [];
    cart.appliedPromocodeId = null;
    const savedCart = await this.cartRepository.save(cart);

    // Уведомление
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_CLEARED, {
          shopId,
          cart: { id: savedCart.id },
        })
        .catch((error) => {
          this.logger.error("Ошибка отправки уведомления об очистке:", error);
        });
    }

    return savedCart;
  }

  /**
   * Валидировать промокод для корзины
   */
  async validatePromocodeForCart(
    shopId: string,
    user: CartUserIdentifier,
    code: string
  ): Promise<{
    isValid: boolean;
    promocode?: any;
    discount?: number;
    message?: string;
  }> {
    const cart = await this.getCart(shopId, user);
    return this.shopPromocodesService.validatePromocode(shopId, code, cart);
  }

  /**
   * Применить промокод к корзине
   */
  async applyPromocode(
    shopId: string,
    user: CartUserIdentifier,
    code: string
  ): Promise<Cart> {
    const cart = await this.getCart(shopId, user);
    const userLabel = user.telegramUsername || user.publicUserId || "unknown";

    const validation = await this.shopPromocodesService.validatePromocode(
      shopId,
      code,
      cart
    );

    if (!validation.isValid || !validation.promocode) {
      throw new BadRequestException(
        validation.message || "Промокод недействителен"
      );
    }

    cart.appliedPromocodeId = validation.promocode.id;
    const savedCart = await this.cartRepository.save(cart);

    // Уведомление и логирование
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.SHOP_PROMOCODE_USED, {
          shopId,
          promocode: {
            id: validation.promocode.id,
            code: validation.promocode.code,
            type: validation.promocode.type,
            value: validation.promocode.value,
            discount: validation.discount,
          },
          cart: {
            telegramUsername: user.telegramUsername,
            publicUserId: user.publicUserId,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления об использовании промокода:",
            error
          );
        });

      this.activityLogService
        .create({
          type: ActivityType.PROMOCODE_APPLIED,
          level: ActivityLevel.SUCCESS,
          message: `Промокод "${validation.promocode.code}" применен к корзине пользователя ${userLabel}`,
          userId: shop.ownerId,
          metadata: {
            shopId,
            promocodeId: validation.promocode.id,
            promocodeCode: validation.promocode.code,
            promocodeType: validation.promocode.type,
            promocodeValue: validation.promocode.value,
            discount: validation.discount,
            telegramUsername: user.telegramUsername,
            publicUserId: user.publicUserId,
            cartId: savedCart.id,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования применения промокода:", error);
        });
    }

    return savedCart;
  }

  /**
   * Удалить промокод из корзины
   */
  async removePromocode(
    shopId: string,
    user: CartUserIdentifier
  ): Promise<Cart> {
    const cart = await this.getCart(shopId, user);

    // Получаем данные промокода перед удалением
    let promocodeData = null;
    if (cart.appliedPromocodeId) {
      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId, shopId },
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

    // Уведомление
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (shop?.ownerId && promocodeData) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.SHOP_PROMOCODE_UNLINKED, {
          shopId,
          promocode: promocodeData,
          cart: {
            telegramUsername: user.telegramUsername,
            publicUserId: user.publicUserId,
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

    return savedCart;
  }

  /**
   * Получить информацию о примененном промокоде
   */
  async getAppliedPromocodeInfo(
    shopId: string,
    cart: Cart
  ): Promise<{
    promocode?: ShopPromocode;
    discount?: number;
  } | null> {
    if (!cart.appliedPromocodeId) {
      return null;
    }

    try {
      const promocode = await this.promocodeRepository.findOne({
        where: { id: cart.appliedPromocodeId, shopId },
      });

      if (!promocode) {
        return null;
      }

      const validation = await this.shopPromocodesService.validatePromocode(
        shopId,
        promocode.code,
        cart
      );

      if (!validation.isValid || !validation.discount) {
        return null;
      }

      return {
        promocode,
        discount: validation.discount,
      };
    } catch (error) {
      this.logger.error("Ошибка при получении информации о промокоде:", error);
      return null;
    }
  }

  // =====================================================
  // МЕТОДЫ ДЛЯ АДМИНКИ
  // =====================================================

  /**
   * Получить все корзины магазина (для админа)
   */
  async getCartsByShopId(
    shopId: string,
    hideEmpty: boolean = false,
    searchUser?: string,
    searchProduct?: string
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
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const queryBuilder = this.cartRepository
      .createQueryBuilder("cart")
      .where("cart.shopId = :shopId", { shopId });

    if (searchUser && searchUser.trim()) {
      const searchUserLower = searchUser.toLowerCase().trim();
      queryBuilder.andWhere(
        "(LOWER(cart.telegramUsername) LIKE :searchUser OR LOWER(cart.publicUserId) LIKE :searchUser)",
        { searchUser: `%${searchUserLower}%` }
      );
    }

    queryBuilder.orderBy("cart.updatedAt", "DESC");

    let carts = await queryBuilder.getMany();

    if (hideEmpty) {
      carts = carts.filter((cart) => cart.items && cart.items.length > 0);
    }

    if (searchProduct && searchProduct.trim()) {
      const searchProductLower = searchProduct.toLowerCase().trim();
      carts = carts.filter((cart) =>
        cart.items.some((item) =>
          item.name.toLowerCase().includes(searchProductLower)
        )
      );
    }

    // Получаем chatId и информацию о промокодах
    const cartsWithChatId = await Promise.all(
      carts.map(async (cart) => {
        let chatId: string | undefined = undefined;

        if (cart.telegramUsername && shop.botId) {
          const username = cart.telegramUsername.replace("@", "");
          const userMessage = await this.messageRepository
            .createQueryBuilder("message")
            .where("message.botId = :botId", { botId: shop.botId })
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

          chatId = userMessage?.telegramChatId;
        }

        const promocodeInfo = await this.getAppliedPromocodeInfo(shopId, cart);

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
   * Обновить количество товара в корзине (для админа)
   */
  async updateCartItemByAdmin(
    shopId: string,
    cartId: string,
    productId: string,
    quantity: number,
    variationId?: string
  ): Promise<Cart> {
    if (quantity <= 0) {
      throw new BadRequestException("Количество должно быть больше 0");
    }

    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const cart = await this.cartRepository.findOne({
      where: { id: cartId, shopId },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    const product = await this.productRepository.findOne({
      where: { id: productId, shopId },
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Недостаточно товара в наличии. Доступно: ${product.stockQuantity}`
      );
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        (item.variationId ?? null) === (variationId ?? null)
    );

    if (itemIndex < 0) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    cart.items[itemIndex].quantity = quantity;
    const savedCart = await this.cartRepository.save(cart);

    if (shop.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_UPDATED, {
          shopId,
          cart: {
            id: savedCart.id,
            items: savedCart.items,
            totalItems: savedCart.totalItems,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка отправки уведомления:", error);
        });
    }

    return savedCart;
  }

  /**
   * Удалить товар из корзины (для админа)
   */
  async removeCartItemByAdmin(
    shopId: string,
    cartId: string,
    productId: string,
    variationId?: string
  ): Promise<Cart> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const cart = await this.cartRepository.findOne({
      where: { id: cartId, shopId },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        (item.variationId ?? null) === (variationId ?? null)
    );

    if (itemIndex < 0) {
      throw new NotFoundException("Товар не найден в корзине");
    }

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.productId === productId &&
          (item.variationId ?? null) === (variationId ?? null)
        )
    );
    const savedCart = await this.cartRepository.save(cart);

    if (shop.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_ITEM_REMOVED, {
          shopId,
          cart: {
            id: savedCart.id,
            items: savedCart.items,
            totalItems: savedCart.totalItems,
            totalPrice: savedCart.totalPrice,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка отправки уведомления:", error);
        });
    }

    return savedCart;
  }

  /**
   * Очистить корзину (для админа)
   */
  async clearCartByAdmin(shopId: string, cartId: string): Promise<Cart> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const cart = await this.cartRepository.findOne({
      where: { id: cartId, shopId },
    });

    if (!cart) {
      throw new NotFoundException("Корзина не найдена");
    }

    cart.items = [];
    cart.appliedPromocodeId = null;
    const savedCart = await this.cartRepository.save(cart);

    if (shop.ownerId) {
      this.notificationService
        .sendToUser(shop.ownerId, NotificationType.CART_CLEARED, {
          shopId,
          cart: { id: savedCart.id },
        })
        .catch((error) => {
          this.logger.error("Ошибка отправки уведомления об очистке:", error);
        });
    }

    return savedCart;
  }

  // =====================================================
  // ALIAS МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С ShopsController
  // =====================================================

  async getCartByShop(shopId: string, user: CartUserIdentifier): Promise<Cart> {
    return this.getCart(shopId, user);
  }

  async addItemByShop(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    quantity: number = 1,
    variationId?: string
  ): Promise<Cart> {
    return this.addItem(shopId, user, productId, quantity, variationId);
  }

  async updateItemByShop(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    quantity: number,
    variationId?: string
  ): Promise<Cart> {
    return this.updateItem(shopId, user, productId, quantity, variationId);
  }

  async removeItemByShop(
    shopId: string,
    user: CartUserIdentifier,
    productId: string,
    variationId?: string
  ): Promise<Cart> {
    return this.removeItem(shopId, user, productId, variationId);
  }

  async clearCartByShop(
    shopId: string,
    user: CartUserIdentifier
  ): Promise<Cart> {
    return this.clearCart(shopId, user);
  }

  async applyPromocodeByShop(
    shopId: string,
    user: CartUserIdentifier,
    code: string
  ): Promise<Cart> {
    return this.applyPromocode(shopId, user, code);
  }

  async removePromocodeByShop(
    shopId: string,
    user: CartUserIdentifier
  ): Promise<Cart> {
    return this.removePromocode(shopId, user);
  }
}
