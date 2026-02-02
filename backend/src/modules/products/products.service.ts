import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Product } from "../../database/entities/product.entity";
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

    this.logger.log(
      `Creating product for shop ${shopId} with ${createProductDto.images?.length || 0} images`
    );

    const product = this.productRepository.create({
      ...createProductDto,
      shopId,
    });

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

    if (updateProductDto.images && product.images) {
      try {
        await this.uploadService.deleteProductImages(product.images);
        this.logger.log(`Deleted old images for product ${id}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete old images for product ${id}: ${error.message}`
        );
      }
    }

    Object.assign(product, updateProductDto);
    const updatedProduct = await this.productRepository.save(product);

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
