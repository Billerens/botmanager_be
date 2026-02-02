import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import {
  ShopPromocode,
  ShopPromocodeType,
  ShopPromocodeApplicableTo,
} from "../../database/entities/shop-promocode.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import {
  CreateShopPromocodeDto,
  UpdateShopPromocodeDto,
  ShopPromocodeFiltersDto,
} from "./dto/shop-promocode.dto";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { ShopPermissionsService } from "../shops/shop-permissions.service";

@Injectable()
export class ShopPromocodesService {
  private readonly logger = new Logger(ShopPromocodesService.name);

  constructor(
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly notificationService: NotificationService,
    private readonly activityLogService: ActivityLogService,
    private readonly shopPermissionsService: ShopPermissionsService
  ) {}

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
   * Создать промокод
   */
  async create(
    shopId: string,
    userId: string,
    createDto: Omit<CreateShopPromocodeDto, "botId">
  ): Promise<ShopPromocode> {
    const shop = await this.validateShopOwnership(shopId, userId);

    // Проверяем уникальность кода для магазина
    const existingPromocode = await this.promocodeRepository.findOne({
      where: { shopId, code: createDto.code },
    });

    if (existingPromocode) {
      throw new BadRequestException(
        "Промокод с таким кодом уже существует для этого магазина"
      );
    }

    // Валидация в зависимости от типа применимости
    if (createDto.applicableTo === ShopPromocodeApplicableTo.CATEGORY) {
      if (!createDto.categoryId) {
        throw new BadRequestException(
          "Для промокода, применимого к категории, необходимо указать categoryId"
        );
      }
      const category = await this.categoryRepository.findOne({
        where: { id: createDto.categoryId, shopId },
      });
      if (!category) {
        throw new NotFoundException("Категория не найдена");
      }
    }

    if (createDto.applicableTo === ShopPromocodeApplicableTo.PRODUCT) {
      if (!createDto.productId) {
        throw new BadRequestException(
          "Для промокода, применимого к продукту, необходимо указать productId"
        );
      }
      const product = await this.productRepository.findOne({
        where: { id: createDto.productId, shopId },
      });
      if (!product) {
        throw new NotFoundException("Продукт не найден");
      }
    }

    // Валидация значения скидки
    if (createDto.type === ShopPromocodeType.PERCENTAGE) {
      if (createDto.value < 0 || createDto.value > 100) {
        throw new BadRequestException(
          "Процентная скидка должна быть от 0 до 100"
        );
      }
    }

    const promocode = this.promocodeRepository.create({
      ...createDto,
      shopId,
      categoryId:
        createDto.applicableTo === ShopPromocodeApplicableTo.CATEGORY
          ? createDto.categoryId
          : null,
      productId:
        createDto.applicableTo === ShopPromocodeApplicableTo.PRODUCT
          ? createDto.productId
          : null,
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });

    const savedPromocode = await this.promocodeRepository.save(promocode);

    // Уведомление и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_CREATED, {
        shopId,
        promocode: {
          id: savedPromocode.id,
          code: savedPromocode.code,
          type: savedPromocode.type,
          value: savedPromocode.value,
          applicableTo: savedPromocode.applicableTo,
          isActive: savedPromocode.isActive,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления о создании промокода:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PROMOCODE_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан промокод "${savedPromocode.code}" в магазине`,
        userId,
        metadata: {
          shopId,
          promocodeId: savedPromocode.id,
          promocodeCode: savedPromocode.code,
          promocodeType: savedPromocode.type,
          promocodeValue: savedPromocode.value,
          applicableTo: savedPromocode.applicableTo,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования создания промокода:", error);
      });

    return savedPromocode;
  }

  /**
   * Получить все промокоды магазина
   */
  async findAll(
    shopId: string,
    userId: string,
    filters?: ShopPromocodeFiltersDto
  ): Promise<ShopPromocode[]> {
    await this.validateShopOwnership(shopId, userId);

    const where: any = { shopId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.applicableTo) {
      where.applicableTo = filters.applicableTo;
    }

    if (filters?.usageLimit) {
      where.usageLimit = filters.usageLimit;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const promocodes = await this.promocodeRepository.find({
      where,
      relations: ["category", "product"],
      order: { createdAt: "DESC" },
    });

    if (filters?.isAvailable !== undefined) {
      return promocodes.filter(
        (promocode) => promocode.isAvailable === filters.isAvailable
      );
    }

    return promocodes;
  }

  /**
   * Получить промокод по ID
   */
  async findOne(
    id: string,
    shopId: string,
    userId: string
  ): Promise<ShopPromocode> {
    await this.validateShopOwnership(shopId, userId);

    const promocode = await this.promocodeRepository.findOne({
      where: { id, shopId },
      relations: ["category", "product"],
    });

    if (!promocode) {
      throw new NotFoundException("Промокод не найден");
    }

    return promocode;
  }

  /**
   * Обновить промокод
   */
  async update(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateShopPromocodeDto
  ): Promise<ShopPromocode> {
    const shop = await this.validateShopOwnership(shopId, userId);
    const promocode = await this.findOne(id, shopId, userId);

    // Проверяем уникальность кода, если он изменяется
    if (updateDto.code && updateDto.code !== promocode.code) {
      const existingPromocode = await this.promocodeRepository.findOne({
        where: { shopId, code: updateDto.code },
      });

      if (existingPromocode) {
        throw new BadRequestException(
          "Промокод с таким кодом уже существует для этого магазина"
        );
      }
    }

    // Валидация в зависимости от типа применимости
    const applicableTo =
      updateDto.applicableTo !== undefined
        ? updateDto.applicableTo
        : promocode.applicableTo;

    if (applicableTo === ShopPromocodeApplicableTo.CATEGORY) {
      const categoryId =
        updateDto.categoryId !== undefined
          ? updateDto.categoryId
          : promocode.categoryId;
      if (!categoryId) {
        throw new BadRequestException(
          "Для промокода, применимого к категории, необходимо указать categoryId"
        );
      }
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId, shopId },
      });
      if (!category) {
        throw new NotFoundException("Категория не найдена");
      }
    }

    if (applicableTo === ShopPromocodeApplicableTo.PRODUCT) {
      const productId =
        updateDto.productId !== undefined
          ? updateDto.productId
          : promocode.productId;
      if (!productId) {
        throw new BadRequestException(
          "Для промокода, применимого к продукту, необходимо указать productId"
        );
      }
      const product = await this.productRepository.findOne({
        where: { id: productId, shopId },
      });
      if (!product) {
        throw new NotFoundException("Продукт не найден");
      }
    }

    // Валидация значения скидки
    const value =
      updateDto.value !== undefined ? updateDto.value : promocode.value;
    const type = updateDto.type !== undefined ? updateDto.type : promocode.type;

    if (type === ShopPromocodeType.PERCENTAGE) {
      if (value < 0 || value > 100) {
        throw new BadRequestException(
          "Процентная скидка должна быть от 0 до 100"
        );
      }
    }

    Object.assign(promocode, updateDto);

    // Очищаем categoryId и productId, если applicableTo изменился
    if (updateDto.applicableTo !== undefined) {
      if (updateDto.applicableTo === ShopPromocodeApplicableTo.CART) {
        promocode.categoryId = null;
        promocode.productId = null;
      } else if (
        updateDto.applicableTo === ShopPromocodeApplicableTo.CATEGORY
      ) {
        promocode.productId = null;
      } else if (updateDto.applicableTo === ShopPromocodeApplicableTo.PRODUCT) {
        promocode.categoryId = null;
      }
    }

    const updatedPromocode = await this.promocodeRepository.save(promocode);

    // Уведомление и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_UPDATED, {
        shopId,
        promocode: {
          id: updatedPromocode.id,
          code: updatedPromocode.code,
          type: updatedPromocode.type,
          value: updatedPromocode.value,
          applicableTo: updatedPromocode.applicableTo,
          isActive: updatedPromocode.isActive,
        },
        changes: updateDto,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об обновлении промокода:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PROMOCODE_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлен промокод "${updatedPromocode.code}"`,
        userId,
        metadata: {
          shopId,
          promocodeId: updatedPromocode.id,
          promocodeCode: updatedPromocode.code,
          changes: updateDto,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления промокода:", error);
      });

    return updatedPromocode;
  }

  /**
   * Удалить промокод
   */
  async remove(id: string, shopId: string, userId: string): Promise<void> {
    await this.validateShopOwnership(shopId, userId);
    const promocode = await this.findOne(id, shopId, userId);

    const promocodeData = {
      id: promocode.id,
      code: promocode.code,
    };

    await this.promocodeRepository.remove(promocode);

    // Уведомление и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_DELETED, {
        shopId,
        promocode: promocodeData,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об удалении промокода:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PROMOCODE_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удален промокод "${promocodeData.code}"`,
        userId,
        metadata: {
          shopId,
          promocodeId: promocodeData.id,
          promocodeCode: promocodeData.code,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления промокода:", error);
      });
  }

  /**
   * Валидировать промокод для корзины
   */
  async validatePromocode(
    shopId: string,
    code: string,
    cart: Cart
  ): Promise<{
    isValid: boolean;
    promocode?: ShopPromocode;
    discount?: number;
    message?: string;
  }> {
    this.logger.log(
      `[PROMOCODE SERVICE] validatePromocode called - shopId: ${shopId}, code: ${code}`
    );

    const promocode = await this.promocodeRepository.findOne({
      where: { shopId, code },
      relations: ["category", "product"],
    });

    if (!promocode) {
      this.logger.warn(
        `[PROMOCODE SERVICE] Promocode not found - shopId: ${shopId}, code: ${code}`
      );
      return {
        isValid: false,
        message: "Промокод не найден",
      };
    }

    this.logger.log(
      `[PROMOCODE SERVICE] Promocode found - id: ${promocode.id}, type: ${promocode.type}, value: ${promocode.value}`
    );

    // Проверяем доступность промокода
    if (!promocode.isAvailable) {
      this.logger.warn(`[PROMOCODE SERVICE] Promocode is not available`);
      return {
        isValid: false,
        message: "Промокод неактивен или истек срок действия",
      };
    }

    // Проверяем применимость к корзине
    if (promocode.applicableTo === ShopPromocodeApplicableTo.CART) {
      const discount = this.calculateDiscount(
        promocode,
        cart.totalPrice,
        cart.items
      );
      return {
        isValid: true,
        promocode,
        discount,
      };
    } else if (
      promocode.applicableTo === ShopPromocodeApplicableTo.CATEGORY &&
      promocode.categoryId
    ) {
      // Загружаем все продукты из корзины
      const productIds = cart.items.map((item) => item.productId);
      const products = await this.productRepository.find({
        where: { id: In(productIds), shopId },
        relations: ["category"],
      });

      // Получаем все подкатегории
      const subcategoryIds = await this.getAllSubcategoryIds(
        promocode.categoryId,
        shopId
      );
      const allCategoryIds = [promocode.categoryId, ...subcategoryIds];

      // Фильтруем товары, которые принадлежат категории или её подкатегориям
      const categoryItems = cart.items.filter((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product || !product.categoryId) return false;
        return allCategoryIds.includes(product.categoryId);
      });

      if (categoryItems.length === 0) {
        return {
          isValid: false,
          message:
            "В корзине нет товаров из категории, к которой применим промокод",
        };
      }

      const categoryTotal = categoryItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const discount = this.calculateDiscount(
        promocode,
        categoryTotal,
        categoryItems
      );
      return {
        isValid: true,
        promocode,
        discount,
      };
    } else if (
      promocode.applicableTo === ShopPromocodeApplicableTo.PRODUCT &&
      promocode.productId
    ) {
      const productItem = cart.items.find(
        (item) => item.productId === promocode.productId
      );

      if (!productItem) {
        return {
          isValid: false,
          message: "В корзине нет товара, к которому применим промокод",
        };
      }

      const productTotal = productItem.price * productItem.quantity;
      const discount = this.calculateDiscount(promocode, productTotal, [
        productItem,
      ]);
      return {
        isValid: true,
        promocode,
        discount,
      };
    }

    return {
      isValid: false,
      message: "Промокод не применим к данной корзине",
    };
  }

  /**
   * Рассчитать скидку
   */
  private calculateDiscount(
    promocode: ShopPromocode,
    totalPrice: number,
    items: any[]
  ): number {
    this.logger.log(
      `[PROMOCODE SERVICE] calculateDiscount - type: ${promocode.type}, value: ${promocode.value}, totalPrice: ${totalPrice}`
    );

    let discount: number;
    if (promocode.type === ShopPromocodeType.FIXED) {
      // Фиксированная скидка - не может превышать сумму товаров
      discount = Math.min(Number(promocode.value), totalPrice);
    } else {
      // Процентная скидка
      discount = (totalPrice * Number(promocode.value)) / 100;
    }

    return discount;
  }

  /**
   * Получить все подкатегории для категории
   */
  private async getAllSubcategoryIds(
    categoryId: string,
    shopId: string
  ): Promise<string[]> {
    const subcategoryIds: string[] = [];
    const queue: string[] = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.categoryRepository.find({
        where: { parentId: currentId, shopId },
        select: ["id"],
      });

      for (const child of children) {
        subcategoryIds.push(child.id);
        queue.push(child.id);
      }
    }

    return subcategoryIds;
  }

  /**
   * Увеличить счетчик использований промокода
   */
  async incrementUsageCount(promocodeId: string): Promise<void> {
    const promocode = await this.promocodeRepository.findOne({
      where: { id: promocodeId },
    });

    if (promocode) {
      promocode.currentUsageCount += 1;
      await this.promocodeRepository.save(promocode);
    }
  }

  // =====================================================
  // ALIAS МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С ShopsController
  // =====================================================

  async createByShop(
    shopId: string,
    userId: string,
    createDto: Omit<CreateShopPromocodeDto, "botId">
  ): Promise<ShopPromocode> {
    return this.create(shopId, userId, createDto);
  }

  async findAllByShop(
    shopId: string,
    userId: string,
    filters?: ShopPromocodeFiltersDto
  ): Promise<ShopPromocode[]> {
    return this.findAll(shopId, userId, filters);
  }

  async findOneByShop(
    id: string,
    shopId: string,
    userId: string
  ): Promise<ShopPromocode> {
    return this.findOne(id, shopId, userId);
  }

  async updateByShop(
    id: string,
    shopId: string,
    userId: string,
    updateDto: UpdateShopPromocodeDto
  ): Promise<ShopPromocode> {
    return this.update(id, shopId, userId, updateDto);
  }

  async removeByShop(
    id: string,
    shopId: string,
    userId: string
  ): Promise<void> {
    return this.remove(id, shopId, userId);
  }

  async validatePromocodeByShop(
    shopId: string,
    code: string,
    cart: Cart
  ): Promise<{
    isValid: boolean;
    promocode?: ShopPromocode;
    discount?: number;
    message?: string;
  }> {
    return this.validatePromocode(shopId, code, cart);
  }
}
