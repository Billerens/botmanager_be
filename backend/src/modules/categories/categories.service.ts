import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Category } from "../../database/entities/category.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Product } from "../../database/entities/product.entity";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryFiltersDto,
} from "./dto/category.dto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ShopPermissionsService } from "../shops/shop-permissions.service";

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
    private readonly shopPermissionsService: ShopPermissionsService
  ) {}

  // =====================================================
  // МЕТОДЫ ДЛЯ РАБОТЫ С SHOP
  // Legacy методы с botId удалены - используйте методы *ByShop или основные методы с shopId
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
   * Создать категорию для магазина
   */
  async create(
    shopId: string,
    userId: string,
    createCategoryDto: CreateCategoryDto
  ): Promise<Category> {
    await this.validateShopOwnership(shopId, userId);

    // Если указана родительская категория, проверяем её
    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId, shopId },
      });

      if (!parentCategory) {
        throw new NotFoundException("Родительская категория не найдена");
      }
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      shopId,
    });

    const savedCategory = await this.categoryRepository.save(category);

    // Уведомления и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.CATEGORY_CREATED, {
        shopId,
        category: {
          id: savedCategory.id,
          name: savedCategory.name,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления о создании категории:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.CATEGORY_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создана категория "${savedCategory.name}"`,
        userId,
        metadata: {
          shopId,
          categoryId: savedCategory.id,
          categoryName: savedCategory.name,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования создания категории:", error);
      });

    return savedCategory;
  }

  /**
   * Получить все категории магазина
   */
  async findAll(
    shopId: string,
    userId: string,
    filters?: CategoryFiltersDto
  ): Promise<Category[]> {
    await this.validateShopOwnership(shopId, userId);

    const queryBuilder = this.categoryRepository
      .createQueryBuilder("category")
      .leftJoinAndSelect("category.parent", "parent")
      .leftJoinAndSelect("category.children", "children")
      .where("category.shopId = :shopId", { shopId })
      .orderBy("category.sortOrder", "ASC")
      .addOrderBy("category.name", "ASC");

    if (filters?.parentId !== undefined) {
      if (filters.parentId === null) {
        queryBuilder.andWhere("category.parentId IS NULL");
      } else {
        queryBuilder.andWhere("category.parentId = :parentId", {
          parentId: filters.parentId,
        });
      }
    } else if (filters?.rootOnly) {
      queryBuilder.andWhere("category.parentId IS NULL");
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere("category.isActive = :isActive", {
        isActive: filters.isActive,
      });
    }

    return await queryBuilder.getMany();
  }

  /**
   * Получить категорию по ID
   */
  async findOne(id: string, shopId: string, userId: string): Promise<Category> {
    await this.validateShopOwnership(shopId, userId);

    const category = await this.categoryRepository.findOne({
      where: { id, shopId },
      relations: ["parent", "children", "products"],
    });

    if (!category) {
      throw new NotFoundException("Категория не найдена");
    }

    return category;
  }

  /**
   * Получить дерево категорий магазина
   */
  async findTree(shopId: string, userId: string): Promise<Category[]> {
    await this.validateShopOwnership(shopId, userId);

    const categories = await this.categoryRepository.find({
      where: { shopId, isActive: true },
      relations: ["parent", "children"],
      order: { sortOrder: "ASC", name: "ASC" },
    });

    return this.buildCategoryTree(categories);
  }

  /**
   * Обновить категорию
   */
  async update(
    id: string,
    shopId: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto
  ): Promise<Category> {
    await this.validateShopOwnership(shopId, userId);
    const category = await this.findOne(id, shopId, userId);

    // Если обновляется родительская категория
    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === null) {
        category.parentId = null;
      } else {
        if (updateCategoryDto.parentId === id) {
          throw new BadRequestException(
            "Категория не может быть родительской для самой себя"
          );
        }

        // Проверяем циклическую зависимость
        if (
          await this.wouldCreateCycle(id, updateCategoryDto.parentId, shopId)
        ) {
          throw new BadRequestException(
            "Невозможно установить родительскую категорию: будет создана циклическая зависимость"
          );
        }

        const parentCategory = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parentId, shopId },
        });

        if (!parentCategory) {
          throw new NotFoundException("Родительская категория не найдена");
        }

        category.parentId = updateCategoryDto.parentId;
      }
    }

    Object.assign(category, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.save(category);

    // Уведомления и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.CATEGORY_UPDATED, {
        shopId,
        category: {
          id: updatedCategory.id,
          name: updatedCategory.name,
        },
        changes: updateCategoryDto,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об обновлении категории:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.CATEGORY_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлена категория "${updatedCategory.name}"`,
        userId,
        metadata: {
          shopId,
          categoryId: updatedCategory.id,
          categoryName: updatedCategory.name,
          changes: updateCategoryDto,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления категории:", error);
      });

    return updatedCategory;
  }

  /**
   * Удалить категорию
   */
  async remove(id: string, shopId: string, userId: string): Promise<void> {
    await this.validateShopOwnership(shopId, userId);
    const category = await this.findOne(id, shopId, userId);

    // Проверяем, есть ли подкатегории
    const childCount = await this.categoryRepository.count({
      where: { parentId: id, shopId },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        "Нельзя удалить категорию, у которой есть подкатегории"
      );
    }

    // Проверяем, есть ли товары в категории
    const productCount = await this.productRepository.count({
      where: { categoryId: id, shopId },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Нельзя удалить категорию, в которой есть товары"
      );
    }

    const categoryData = { id: category.id, name: category.name };
    await this.categoryRepository.remove(category);

    // Уведомления и логирование
    this.notificationService
      .sendToUser(userId, NotificationType.CATEGORY_DELETED, {
        shopId,
        category: categoryData,
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка отправки уведомления об удалении категории:",
          error
        );
      });

    this.activityLogService
      .create({
        type: ActivityType.CATEGORY_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удалена категория "${categoryData.name}"`,
        userId,
        metadata: {
          shopId,
          categoryId: categoryData.id,
          categoryName: categoryData.name,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления категории:", error);
      });
  }

  /**
   * Получить статистику по категории
   */
  async getCategoryStats(
    categoryId: string,
    shopId: string,
    userId: string
  ): Promise<{
    totalProducts: number;
    activeProducts: number;
    subcategoriesCount: number;
  }> {
    await this.validateShopOwnership(shopId, userId);

    await this.findOne(categoryId, shopId, userId);
    const subcategoryIds = await this.getAllSubcategoryIds(categoryId, shopId);
    const allCategoryIds = [categoryId, ...subcategoryIds];

    const [totalProducts, activeProducts, subcategoriesCount] =
      await Promise.all([
        this.productRepository.count({
          where: { categoryId: In(allCategoryIds), shopId },
        }),
        this.productRepository.count({
          where: { categoryId: In(allCategoryIds), shopId, isActive: true },
        }),
        this.categoryRepository.count({
          where: { parentId: categoryId, shopId },
        }),
      ]);

    return {
      totalProducts,
      activeProducts,
      subcategoriesCount,
    };
  }

  /**
   * Переключить активность категории
   */
  async toggleActive(
    id: string,
    shopId: string,
    userId: string
  ): Promise<Category> {
    const category = await this.findOne(id, shopId, userId);
    category.isActive = !category.isActive;
    return await this.categoryRepository.save(category);
  }

  // Приватные методы

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

  /**
   * Проверить, создаст ли установка новой родительской категории циклическую зависимость
   */
  private async wouldCreateCycle(
    categoryId: string,
    newParentId: string,
    shopId: string
  ): Promise<boolean> {
    if (categoryId === newParentId) {
      return true;
    }

    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        return true;
      }

      if (currentId === categoryId) {
        return true;
      }

      visited.add(currentId);

      const category = await this.categoryRepository.findOne({
        where: { id: currentId, shopId },
        select: ["id", "parentId"],
      });

      currentId = category?.parentId || null;
    }

    return false;
  }

  /**
   * Построить дерево категорий из плоского списка
   */
  private buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category & { children: Category[] }>();
    const rootCategories: Category[] = [];

    for (const category of categories) {
      const categoryWithChildren = Object.assign(category, { children: [] });
      categoryMap.set(category.id, categoryWithChildren);
    }

    for (const category of categories) {
      const categoryNode = categoryMap.get(category.id)!;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(categoryNode);
        }
      } else {
        rootCategories.push(categoryNode);
      }
    }

    return rootCategories;
  }
}
