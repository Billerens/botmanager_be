import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import {
  ShopPromocode,
  ShopPromocodeType,
  ShopPromocodeApplicableTo,
} from "../../database/entities/shop-promocode.entity";
import { Bot } from "../../database/entities/bot.entity";
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

@Injectable()
export class ShopPromocodesService {
  private readonly logger = new Logger(ShopPromocodesService.name);

  constructor(
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Создать промокод
   */
  async create(
    createDto: CreateShopPromocodeDto,
    userId: string
  ): Promise<ShopPromocode> {
    // Проверяем, что бот принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: createDto.botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем уникальность кода для бота
    const existingPromocode = await this.promocodeRepository.findOne({
      where: { botId: createDto.botId, code: createDto.code },
    });

    if (existingPromocode) {
      throw new BadRequestException(
        "Промокод с таким кодом уже существует для этого бота"
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
        where: { id: createDto.categoryId, botId: createDto.botId },
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
        where: { id: createDto.productId, botId: createDto.botId },
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

    // Отправляем уведомление о создании промокода
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_CREATED, {
        botId: createDto.botId,
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

    return savedPromocode;
  }

  /**
   * Получить все промокоды бота
   */
  async findAll(
    botId: string,
    userId: string,
    filters?: ShopPromocodeFiltersDto
  ): Promise<ShopPromocode[]> {
    await this.validateBotOwnership(botId, userId);

    const where: any = { botId };

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

    // Фильтрация по isAvailable (вычисляемое поле) на уровне приложения
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
    botId: string,
    userId: string
  ): Promise<ShopPromocode> {
    await this.validateBotOwnership(botId, userId);

    const promocode = await this.promocodeRepository.findOne({
      where: { id, botId },
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
    botId: string,
    userId: string,
    updateDto: UpdateShopPromocodeDto
  ): Promise<ShopPromocode> {
    const promocode = await this.findOne(id, botId, userId);

    // Проверяем уникальность кода, если он изменяется
    if (updateDto.code && updateDto.code !== promocode.code) {
      const existingPromocode = await this.promocodeRepository.findOne({
        where: { botId, code: updateDto.code },
      });

      if (existingPromocode) {
        throw new BadRequestException(
          "Промокод с таким кодом уже существует для этого бота"
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
        where: { id: categoryId, botId },
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
        where: { id: productId, botId },
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

    // Отправляем уведомление об обновлении промокода
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_UPDATED, {
        botId,
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

    return updatedPromocode;
  }

  /**
   * Удалить промокод
   */
  async remove(id: string, botId: string, userId: string): Promise<void> {
    const promocode = await this.findOne(id, botId, userId);

    const promocodeData = {
      id: promocode.id,
      code: promocode.code,
    };

    await this.promocodeRepository.remove(promocode);

    // Отправляем уведомление об удалении промокода
    this.notificationService
      .sendToUser(userId, NotificationType.SHOP_PROMOCODE_DELETED, {
        botId,
        promocode: promocodeData,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об удалении промокода:",
          error
        );
      });
  }

  /**
   * Валидировать промокод для корзины
   */
  async validatePromocode(
    botId: string,
    code: string,
    cart: Cart
  ): Promise<{
    isValid: boolean;
    promocode?: ShopPromocode;
    discount?: number;
    message?: string;
  }> {
    this.logger.log(`[PROMOCODE SERVICE] validatePromocode called - botId: ${botId}, code: ${code}, cartId: ${cart.id}, cart items count: ${cart.items?.length || 0}`);
    
    const promocode = await this.promocodeRepository.findOne({
      where: { botId, code },
      relations: ["category", "product"],
    });

    if (!promocode) {
      this.logger.warn(`[PROMOCODE SERVICE] Promocode not found - botId: ${botId}, code: ${code}`);
      return {
        isValid: false,
        message: "Промокод не найден",
      };
    }

    this.logger.log(`[PROMOCODE SERVICE] Promocode found - id: ${promocode.id}, type: ${promocode.type}, value: ${promocode.value}, applicableTo: ${promocode.applicableTo}, isActive: ${promocode.isActive}, isAvailable: ${promocode.isAvailable}`);

    // Проверяем доступность промокода
    if (!promocode.isAvailable) {
      this.logger.warn(`[PROMOCODE SERVICE] Promocode is not available - id: ${promocode.id}, code: ${promocode.code}`);
      return {
        isValid: false,
        message: "Промокод неактивен или истек срок действия",
      };
    }

    // Проверяем применимость к корзине
    if (promocode.applicableTo === ShopPromocodeApplicableTo.CART) {
      this.logger.log(`[PROMOCODE SERVICE] Promocode applicable to CART - cart totalPrice: ${cart.totalPrice}`);
      // Промокод применим ко всей корзине
      const discount = this.calculateDiscount(
        promocode,
        cart.totalPrice,
        cart.items
      );
      this.logger.log(`[PROMOCODE SERVICE] Calculated discount for CART: ${discount}`);
      return {
        isValid: true,
        promocode,
        discount,
      };
    } else if (
      promocode.applicableTo === ShopPromocodeApplicableTo.CATEGORY &&
      promocode.categoryId
    ) {
      // Промокод применим к категории - проверяем, есть ли товары этой категории в корзине
      // Загружаем все продукты из корзины
      const productIds = cart.items.map((item) => item.productId);
      const products = await this.productRepository.find({
        where: { id: In(productIds), botId },
        relations: ["category"],
      });

      // Получаем все подкатегории для категории промокода
      const getAllSubcategoryIds = async (
        categoryId: string
      ): Promise<string[]> => {
        const subcategoryIds: string[] = [];
        const queue: string[] = [categoryId];

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const children = await this.categoryRepository.find({
            where: { parentId: currentId, botId },
            select: ["id"],
          });

          for (const child of children) {
            subcategoryIds.push(child.id);
            queue.push(child.id);
          }
        }

        return subcategoryIds;
      };

      const subcategoryIds = await getAllSubcategoryIds(promocode.categoryId);
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
      this.logger.log(`[PROMOCODE SERVICE] Category items found: ${categoryItems.length}, categoryTotal: ${categoryTotal}`);
      const discount = this.calculateDiscount(
        promocode,
        categoryTotal,
        categoryItems
      );
      this.logger.log(`[PROMOCODE SERVICE] Calculated discount for CATEGORY: ${discount}`);
      return {
        isValid: true,
        promocode,
        discount,
      };
    } else if (
      promocode.applicableTo === ShopPromocodeApplicableTo.PRODUCT &&
      promocode.productId
    ) {
      // Промокод применим к продукту - проверяем, есть ли этот товар в корзине
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
      this.logger.log(`[PROMOCODE SERVICE] Product item found - productTotal: ${productTotal}`);
      const discount = this.calculateDiscount(promocode, productTotal, [
        productItem,
      ]);
      this.logger.log(`[PROMOCODE SERVICE] Calculated discount for PRODUCT: ${discount}`);
      return {
        isValid: true,
        promocode,
        discount,
      };
    }

    this.logger.warn(`[PROMOCODE SERVICE] Promocode not applicable to cart - applicableTo: ${promocode.applicableTo}`);
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
    this.logger.log(`[PROMOCODE SERVICE] calculateDiscount - type: ${promocode.type}, value: ${promocode.value}, totalPrice: ${totalPrice}, items count: ${items.length}`);
    
    let discount: number;
    if (promocode.type === ShopPromocodeType.FIXED) {
      // Фиксированная скидка - не может превышать сумму товаров
      discount = Math.min(Number(promocode.value), totalPrice);
      this.logger.log(`[PROMOCODE SERVICE] Fixed discount calculated: ${discount} (min of ${promocode.value} and ${totalPrice})`);
    } else {
      // Процентная скидка
      discount = (totalPrice * Number(promocode.value)) / 100;
      this.logger.log(`[PROMOCODE SERVICE] Percentage discount calculated: ${discount} (${promocode.value}% of ${totalPrice})`);
    }
    
    return discount;
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

  /**
   * Проверить владение ботом
   */
  private async validateBotOwnership(
    botId: string,
    userId: string
  ): Promise<void> {
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }
  }
}
