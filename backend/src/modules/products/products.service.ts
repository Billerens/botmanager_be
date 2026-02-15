import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Product,
  ProductVariation,
} from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Shop } from "../../database/entities/shop.entity";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "./dto/product.dto";
import { UploadService } from "../upload/upload.service";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { ShopPermissionsService } from "../shops/shop-permissions.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  outOfStockProducts: number;
  totalValue: number;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly uploadService: UploadService,
    private readonly notificationService: NotificationService,
    private readonly activityLogService: ActivityLogService,
    private readonly shopPermissionsService: ShopPermissionsService
  ) {}

  // =====================================================
  // МЕТОДЫ ДЛЯ РАБОТЫ С SHOP
  // Legacy методы с botId удалены - используйте методы *ByShop
  // =====================================================

  /**
   * Нормализация вариаций: только массив объектов с id, label (отсекает [[], []], пустые объекты и т.д.).
   * Поддерживает передачу массива или JSON-строки (form-data, двойная сериализация).
   */
  private normalizeVariations(
    variations: unknown,
  ): ProductVariation[] | null | undefined {
    this.logger.debug(
      `[variations] normalizeVariations input: type=${typeof variations}, isArray=${Array.isArray(variations)}, value=${JSON.stringify(variations?.toString?.() ?? variations)}`
    );
    if (variations == null) return undefined;
    let arr: unknown[];
    if (Array.isArray(variations)) {
      arr = variations;
    } else if (typeof variations === "string") {
      try {
        const parsed = JSON.parse(variations) as unknown;
        if (!Array.isArray(parsed)) return null;
        arr = parsed;
      } catch {
        return null;
      }
    } else {
      this.logger.warn(`[variations] normalizeVariations: not array or string, got ${typeof variations}`);
      return null;
    }
    const filtered = arr.filter(
      (item): item is ProductVariation =>
        item != null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "id" in item &&
        "label" in item
    );
    const result = filtered.length > 0 ? filtered : null;
    this.logger.debug(`[variations] normalizeVariations result: ${filtered.length} items, returning ${result === null ? "null" : "array"}`);
    return result;
  }

  /**
   * Создать продукт для магазина
   */
  async create(
    shopId: string,
    userId: string,
    createProductDto: CreateProductDto
  ): Promise<Product> {
    const shop = await this.validateShopOwnership(shopId, userId);

    // Если указана категория, проверяем её
    if (createProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: createProductDto.categoryId, shopId },
      });

      if (!category) {
        throw new NotFoundException("Категория не найдена");
      }
    }

    const variations = this.normalizeVariations(createProductDto.variations);
    const payload = {
      ...createProductDto,
      shopId,
      ...(variations !== undefined && { variations }),
    };

    this.logger.log(
      `Creating product for shop ${shopId} with ${createProductDto.images?.length || 0} images`
    );

    const product = this.productRepository.create(payload);

    const savedProduct = await this.productRepository.save(product);

    // Уведомления и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.PRODUCT_CREATED, {
        shopId,
        product: {
          id: savedProduct.id,
          name: savedProduct.name,
          price: savedProduct.price,
          stockQuantity: savedProduct.stockQuantity,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления о создании продукта:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PRODUCT_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан товар "${savedProduct.name}" в магазине`,
        userId,
        metadata: {
          shopId,
          productId: savedProduct.id,
          productName: savedProduct.name,
          productPrice: savedProduct.price,
          stockQuantity: savedProduct.stockQuantity,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования создания продукта:", error);
      });

    return savedProduct;
  }

  /**
   * Получить все продукты магазина
   */
  async findAll(shopId: string, userId: string, filters: ProductFiltersDto) {
    await this.validateShopOwnership(shopId, userId);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const { search, isActive, inStock } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.category", "category")
      .where("product.shopId = :shopId", { shopId })
      .skip(skip)
      .take(limit)
      .orderBy("product.createdAt", "DESC");

    if (search) {
      queryBuilder.andWhere("product.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere("product.isActive = :isActive", { isActive });
    }

    if (inStock !== undefined) {
      if (inStock) {
        queryBuilder.andWhere("product.stockQuantity > 0");
      } else {
        queryBuilder.andWhere("product.stockQuantity = 0");
      }
    }

    if (filters.categoryId) {
      const subcategoryIds = await this.getAllSubcategoryIds(
        filters.categoryId,
        shopId
      );
      const allCategoryIds = [filters.categoryId, ...subcategoryIds];

      queryBuilder.andWhere("product.categoryId IN (:...categoryIds)", {
        categoryIds: allCategoryIds,
      });
    }

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить продукт по ID
   */
  async findOne(id: string, shopId: string, userId: string): Promise<Product> {
    await this.validateShopOwnership(shopId, userId);

    const product = await this.productRepository.findOne({
      where: { id, shopId },
      relations: ["category"],
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    return product;
  }

  /**
   * Обновить продукт
   */
  async update(
    id: string,
    shopId: string,
    userId: string,
    updateProductDto: UpdateProductDto
  ): Promise<Product> {
    await this.validateShopOwnership(shopId, userId);
    const product = await this.findOne(id, shopId, userId);

    if (updateProductDto.categoryId !== undefined) {
      if (updateProductDto.categoryId === null) {
        product.categoryId = null;
      } else {
        const category = await this.categoryRepository.findOne({
          where: { id: updateProductDto.categoryId, shopId },
        });

        if (!category) {
          throw new NotFoundException("Категория не найдена");
        }

        product.categoryId = updateProductDto.categoryId;
      }
    }

    // Удаляем из S3 только те картинки, которых нет в новом списке (чтобы не бить ссылки при PATCH без смены картинок)
    if (
      updateProductDto.images &&
      product.images?.length
    ) {
      const newUrls = new Set(
        Array.isArray(updateProductDto.images) ? updateProductDto.images : []
      );
      const urlsToDelete = product.images.filter((url) => !newUrls.has(url));
      if (urlsToDelete.length > 0) {
        try {
          await this.uploadService.deleteProductImages(urlsToDelete);
          this.logger.log(
            `Deleted ${urlsToDelete.length} old images for product ${id}`
          );
        } catch (error) {
          this.logger.warn(
            `Failed to delete old images for product ${id}: ${error.message}`
          );
        }
      }
    }

    // Логирование входящего DTO (в т.ч. variations) — флоу PATCH product
    const rawVariations = (updateProductDto as Record<string, unknown>).variations;
    this.logger.log(
      `[variations] PATCH product ${id}: dto.variations type=${typeof rawVariations}, isArray=${Array.isArray(rawVariations)}, hasKey=${"variations" in updateProductDto}`
    );

    const variations = this.normalizeVariations(updateProductDto.variations);

    // Собираем payload только по известным полям DTO, без undefined
    const allowedKeys = [
      "name",
      "price",
      "currency",
      "stockQuantity",
      "images",
      "parameters",
      "variations",
      "allowBaseOption",
      "description",
      "isActive",
      "categoryId",
    ] as const;
    const updatePayload: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      const val = (updateProductDto as Record<string, unknown>)[key];
      if (val !== undefined) updatePayload[key] = val;
    }
    if (variations !== undefined) {
      updatePayload.variations = variations;
    }

    this.logger.log(
      `[variations] PATCH product ${id}: normalized=${variations !== undefined ? (Array.isArray(variations) ? variations.length : "null") : "undefined"}, payload.variations=${updatePayload.variations !== undefined ? "set" : "unset"}`
    );

    Object.assign(product, updatePayload);
    // Явно выставляем variations на сущности, чтобы не терять при save
    if (variations !== undefined) {
      product.variations = variations;
    }

    const updatedProduct = await this.productRepository.save(product);

    this.logger.log(
      `[variations] PATCH product ${id} after save: product.variations=${updatedProduct.variations == null ? "null" : `array(${(updatedProduct.variations as unknown[]).length})`}`
    );

    this.notificationService
      .sendToUser(userId, NotificationType.PRODUCT_UPDATED, {
        shopId,
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          price: updatedProduct.price,
          stockQuantity: updatedProduct.stockQuantity,
        },
        changes: updateProductDto,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об обновлении продукта:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PRODUCT_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлен товар "${updatedProduct.name}"`,
        userId,
        metadata: {
          shopId,
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          changes: updateProductDto,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления продукта:", error);
      });

    return updatedProduct;
  }

  /**
   * Удалить продукт
   */
  async remove(id: string, shopId: string, userId: string): Promise<void> {
    await this.validateShopOwnership(shopId, userId);
    const product = await this.findOne(id, shopId, userId);

    if (product.images && product.images.length > 0) {
      try {
        await this.uploadService.deleteProductImages(product.images);
        this.logger.log(`Deleted images for product ${id}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete images for product ${id}: ${error.message}`
        );
      }
    }

    const productData = { id: product.id, name: product.name };
    await this.productRepository.remove(product);

    this.notificationService
      .sendToUser(userId, NotificationType.PRODUCT_DELETED, {
        shopId,
        product: productData,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об удалении продукта:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.PRODUCT_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удален товар "${productData.name}"`,
        userId,
        metadata: {
          shopId,
          productId: productData.id,
          productName: productData.name,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления продукта:", error);
      });
  }

  /**
   * Получить статистику продуктов магазина
   */
  async getProductStats(shopId: string, userId: string): Promise<ProductStats> {
    await this.validateShopOwnership(shopId, userId);

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      totalValueResult,
    ] = await Promise.all([
      this.productRepository.count({ where: { shopId } }),
      this.productRepository.count({ where: { shopId, isActive: true } }),
      this.productRepository.count({ where: { shopId, isActive: false } }),
      this.productRepository.count({ where: { shopId, stockQuantity: 0 } }),
      this.productRepository
        .createQueryBuilder("product")
        .select("SUM(product.price * product.stockQuantity)", "totalValue")
        .where("product.shopId = :shopId", { shopId })
        .getRawOne(),
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      totalValue: parseFloat(totalValueResult?.totalValue || "0"),
    };
  }

  /**
   * Обновить сток продукта
   */
  async updateStock(
    id: string,
    shopId: string,
    userId: string,
    quantity: number
  ): Promise<Product> {
    await this.validateShopOwnership(shopId, userId);
    const product = await this.findOne(id, shopId, userId);
    const oldStock = product.stockQuantity;

    product.stockQuantity = quantity;
    const updatedProduct = await this.productRepository.save(product);

    const lowStockThreshold = 5;
    if (
      updatedProduct.stockQuantity <= lowStockThreshold &&
      oldStock > lowStockThreshold
    ) {
      this.notificationService
        .sendToUser(userId, NotificationType.PRODUCT_STOCK_LOW, {
          shopId,
          product: {
            id: updatedProduct.id,
            name: updatedProduct.name,
            stockQuantity: updatedProduct.stockQuantity,
          },
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления о низком запасе:",
            error
          );
        });
    }

    this.activityLogService
      .create({
        type: ActivityType.PRODUCT_STOCK_UPDATED,
        level: ActivityLevel.INFO,
        message: `Изменен сток товара "${updatedProduct.name}": ${oldStock} → ${quantity}`,
        userId,
        metadata: {
          shopId,
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          oldStock,
          newStock: quantity,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования изменения стока:", error);
      });

    return updatedProduct;
  }

  /**
   * Переключить активность продукта
   */
  async toggleActive(
    id: string,
    shopId: string,
    userId: string
  ): Promise<Product> {
    const product = await this.findOne(id, shopId, userId);
    product.isActive = !product.isActive;
    return await this.productRepository.save(product);
  }

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
   * Получить все ID подкатегорий (рекурсивно)
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
}
