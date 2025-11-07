import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, Between, In } from "typeorm";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Category } from "../../database/entities/category.entity";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "./dto/product.dto";
import { UploadService } from "../upload/upload.service";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";

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
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly uploadService: UploadService,
    private readonly notificationService: NotificationService
  ) {}

  async create(
    botId: string,
    userId: string,
    createProductDto: CreateProductDto
  ): Promise<Product> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    // Если указана категория, проверяем её
    if (createProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: createProductDto.categoryId, botId },
      });

      if (!category) {
        throw new NotFoundException("Категория не найдена");
      }
    }

    this.logger.log(
      `Creating product with ${createProductDto.images?.length || 0} images`
    );

    const product = this.productRepository.create({
      ...createProductDto,
      botId,
    });

    const savedProduct = await this.productRepository.save(product);

    // Отправляем уведомление о создании продукта
    this.notificationService.sendToUser(userId, NotificationType.PRODUCT_CREATED, {
      botId,
      product: {
        id: savedProduct.id,
        name: savedProduct.name,
        price: savedProduct.price,
        stockQuantity: savedProduct.stockQuantity,
      },
    }).catch((error) => {
      this.logger.error("Ошибка отправки уведомления о создании продукта:", error);
    });

    return savedProduct;
  }

  async findAll(botId: string, userId: string, filters: ProductFiltersDto) {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    // Устанавливаем значения по умолчанию если они не переданы
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const { search, isActive, inStock } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.category", "category")
      .where("product.botId = :botId", { botId })
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

    // Фильтр по категории (включая подкатегории)
    if (filters.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: filters.categoryId, botId },
      });

      if (category) {
        // Получаем все подкатегории
        const subcategoryIds = await this.getAllSubcategoryIds(
          filters.categoryId,
          botId
        );
        const allCategoryIds = [filters.categoryId, ...subcategoryIds];

        queryBuilder.andWhere("product.categoryId IN (:...categoryIds)", {
          categoryIds: allCategoryIds,
        });
      } else {
        // Если категория не найдена, возвращаем пустой результат
        queryBuilder.andWhere("1 = 0");
      }
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

  async findOne(id: string, botId: string, userId: string): Promise<Product> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    const product = await this.productRepository.findOne({
      where: { id, botId },
      relations: ["category"],
    });

    if (!product) {
      throw new NotFoundException("Товар не найден");
    }

    return product;
  }

  async update(
    id: string,
    botId: string,
    userId: string,
    updateProductDto: UpdateProductDto
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);

    // Если обновляется категория, проверяем её
    if (updateProductDto.categoryId !== undefined) {
      if (updateProductDto.categoryId === null) {
        // Убираем категорию
        product.categoryId = null;
      } else {
        const category = await this.categoryRepository.findOne({
          where: { id: updateProductDto.categoryId, botId },
        });

        if (!category) {
          throw new NotFoundException("Категория не найдена");
        }

        product.categoryId = updateProductDto.categoryId;
      }
    }

    this.logger.log(
      `Updating product ${id} with ${updateProductDto.images?.length || 0} images`
    );

    // Если обновляются изображения, удаляем старые из S3
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

    // Отправляем уведомление об обновлении продукта
    this.notificationService.sendToUser(userId, NotificationType.PRODUCT_UPDATED, {
      botId,
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        price: updatedProduct.price,
        stockQuantity: updatedProduct.stockQuantity,
      },
      changes: updateProductDto,
    }).catch((error) => {
      this.logger.error("Ошибка отправки уведомления об обновлении продукта:", error);
    });

    return updatedProduct;
  }

  async remove(id: string, botId: string, userId: string): Promise<void> {
    const product = await this.findOne(id, botId, userId);

    // Удаляем изображения из S3 перед удалением продукта
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

    const productData = {
      id: product.id,
      name: product.name,
    };

    await this.productRepository.remove(product);

    // Отправляем уведомление об удалении продукта
    this.notificationService.sendToUser(userId, NotificationType.PRODUCT_DELETED, {
      botId,
      product: productData,
    }).catch((error) => {
      this.logger.error("Ошибка отправки уведомления об удалении продукта:", error);
    });
  }

  async getBotProductStats(
    botId: string,
    userId: string
  ): Promise<ProductStats> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStockProducts,
      totalValueResult,
    ] = await Promise.all([
      this.productRepository.count({ where: { botId } }),
      this.productRepository.count({ where: { botId, isActive: true } }),
      this.productRepository.count({ where: { botId, isActive: false } }),
      this.productRepository.count({ where: { botId, stockQuantity: 0 } }),
      this.productRepository
        .createQueryBuilder("product")
        .select("SUM(product.price * product.stockQuantity)", "totalValue")
        .where("product.botId = :botId", { botId })
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

  async updateStock(
    id: string,
    botId: string,
    userId: string,
    quantity: number
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);
    const oldStock = product.stockQuantity;

    product.stockQuantity = quantity;
    const updatedProduct = await this.productRepository.save(product);

    // Проверяем, стал ли запас низким (меньше 5 единиц)
    const lowStockThreshold = 5;
    if (updatedProduct.stockQuantity <= lowStockThreshold && oldStock > lowStockThreshold) {
      // Отправляем уведомление о низком запасе
      this.notificationService.sendToUser(
        userId,
        NotificationType.PRODUCT_STOCK_LOW,
        {
          botId,
          product: {
            id: updatedProduct.id,
            name: updatedProduct.name,
            stockQuantity: updatedProduct.stockQuantity,
          },
        }
      ).catch((error) => {
        this.logger.error("Ошибка отправки уведомления о низком запасе:", error);
      });
    }

    return updatedProduct;
  }

  async toggleActive(
    id: string,
    botId: string,
    userId: string
  ): Promise<Product> {
    const product = await this.findOne(id, botId, userId);

    product.isActive = !product.isActive;
    return await this.productRepository.save(product);
  }

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

  /**
   * Получить все ID подкатегорий (рекурсивно)
   */
  private async getAllSubcategoryIds(
    categoryId: string,
    botId: string
  ): Promise<string[]> {
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
  }
}
