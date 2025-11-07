import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, TreeRepository, In } from "typeorm";
import { Category } from "../../database/entities/category.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Product } from "../../database/entities/product.entity";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryFiltersDto,
} from "./dto/category.dto";

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  async create(
    botId: string,
    userId: string,
    createCategoryDto: CreateCategoryDto
  ): Promise<Category> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    // Если указана родительская категория, проверяем её
    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId, botId },
      });

      if (!parentCategory) {
        throw new NotFoundException("Родительская категория не найдена");
      }

      // Проверяем, что родительская категория принадлежит тому же боту
      if (parentCategory.botId !== botId) {
        throw new BadRequestException(
          "Родительская категория должна принадлежать тому же боту"
        );
      }
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      botId,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(
    botId: string,
    userId: string,
    filters: CategoryFiltersDto
  ): Promise<Category[]> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    const queryBuilder = this.categoryRepository
      .createQueryBuilder("category")
      .leftJoinAndSelect("category.parent", "parent")
      .leftJoinAndSelect("category.children", "children")
      .where("category.botId = :botId", { botId })
      .orderBy("category.sortOrder", "ASC")
      .addOrderBy("category.name", "ASC");

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        // Получаем только корневые категории
        queryBuilder.andWhere("category.parentId IS NULL");
      } else {
        queryBuilder.andWhere("category.parentId = :parentId", {
          parentId: filters.parentId,
        });
      }
    } else if (filters.rootOnly) {
      queryBuilder.andWhere("category.parentId IS NULL");
    }

    if (filters.isActive !== undefined) {
      queryBuilder.andWhere("category.isActive = :isActive", {
        isActive: filters.isActive,
      });
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: string, botId: string, userId: string): Promise<Category> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    const category = await this.categoryRepository.findOne({
      where: { id, botId },
      relations: ["parent", "children"],
    });

    if (!category) {
      throw new NotFoundException("Категория не найдена");
    }

    return category;
  }

  async findTree(botId: string, userId: string): Promise<Category[]> {
    // Проверяем, что бот принадлежит пользователю
    await this.validateBotOwnership(botId, userId);

    // Получаем все категории бота с подкатегориями
    const categories = await this.categoryRepository.find({
      where: { botId, isActive: true },
      relations: ["parent", "children"],
      order: { sortOrder: "ASC", name: "ASC" },
    });

    // Строим дерево категорий
    return this.buildCategoryTree(categories);
  }

  async update(
    id: string,
    botId: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto
  ): Promise<Category> {
    const category = await this.findOne(id, botId, userId);

    // Если обновляется parentId, проверяем что новая родительская категория существует
    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === null) {
        // Убираем родительскую категорию (делаем корневой)
        category.parentId = null;
      } else {
        // Проверяем, что новая родительская категория существует и принадлежит тому же боту
        const newParent = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parentId, botId },
        });

        if (!newParent) {
          throw new NotFoundException("Родительская категория не найдена");
        }

        // Проверяем, что не создается циклическая зависимость
        if (
          await this.wouldCreateCycle(id, updateCategoryDto.parentId, botId)
        ) {
          throw new BadRequestException(
            "Невозможно установить родительскую категорию: будет создана циклическая зависимость"
          );
        }

        category.parentId = updateCategoryDto.parentId;
      }
    }

    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async remove(id: string, botId: string, userId: string): Promise<void> {
    const category = await this.findOne(id, botId, userId);

    // Проверяем, есть ли подкатегории
    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id, botId },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        "Невозможно удалить категорию: у неё есть подкатегории. Сначала удалите или переместите подкатегории."
      );
    }

    // Проверяем, есть ли товары в этой категории
    const productsCount = await this.productRepository.count({
      where: { categoryId: id, botId },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        "Невозможно удалить категорию: в ней есть товары. Сначала переместите или удалите товары."
      );
    }

    await this.categoryRepository.remove(category);
  }

  /**
   * Получить все товары категории, включая товары из подкатегорий
   */
  async getCategoryProducts(
    categoryId: string,
    botId: string,
    userId: string,
    includeSubcategories: boolean = true
  ): Promise<Product[]> {
    await this.validateBotOwnership(botId, userId);

    const category = await this.findOne(categoryId, botId, userId);

    if (includeSubcategories) {
      // Получаем все подкатегории (рекурсивно)
      const subcategoryIds = await this.getAllSubcategoryIds(categoryId, botId);
      const allCategoryIds = [categoryId, ...subcategoryIds];

      return await this.productRepository.find({
        where: { categoryId: In(allCategoryIds), botId },
        relations: ["category"],
        order: { createdAt: "DESC" },
      });
    } else {
      // Только товары этой категории
      return await this.productRepository.find({
        where: { categoryId, botId },
        relations: ["category"],
        order: { createdAt: "DESC" },
      });
    }
  }

  /**
   * Получить все родительские категории для товара
   * Если товар в подкатегории, он также относится ко всем родительским категориям
   */
  async getProductCategories(
    productId: string,
    botId: string
  ): Promise<Category[]> {
    const product = await this.productRepository.findOne({
      where: { id: productId, botId },
      relations: ["category"],
    });

    if (!product || !product.category) {
      return [];
    }

    const categories: Category[] = [product.category];
    let currentCategory: Category | null = product.category;

    // Поднимаемся по дереву категорий до корня
    while (currentCategory?.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: currentCategory.parentId, botId },
        relations: ["parent"],
      });

      if (parent) {
        categories.unshift(parent); // Добавляем в начало массива
        currentCategory = parent;
      } else {
        break;
      }
    }

    return categories;
  }

  /**
   * Получить статистику по категории
   */
  async getCategoryStats(
    categoryId: string,
    botId: string,
    userId: string
  ): Promise<{
    totalProducts: number;
    activeProducts: number;
    subcategoriesCount: number;
  }> {
    await this.validateBotOwnership(botId, userId);

    const category = await this.findOne(categoryId, botId, userId);
    const subcategoryIds = await this.getAllSubcategoryIds(categoryId, botId);
    const allCategoryIds = [categoryId, ...subcategoryIds];

    const [totalProducts, activeProducts, subcategoriesCount] =
      await Promise.all([
        this.productRepository.count({
          where: { categoryId: In(allCategoryIds), botId },
        }),
        this.productRepository.count({
          where: { categoryId: In(allCategoryIds), botId, isActive: true },
        }),
        this.categoryRepository.count({
          where: { parentId: categoryId, botId },
        }),
      ]);

    return {
      totalProducts,
      activeProducts,
      subcategoriesCount,
    };
  }

  // Приватные методы

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

  /**
   * Проверить, создаст ли установка новой родительской категории циклическую зависимость
   */
  private async wouldCreateCycle(
    categoryId: string,
    newParentId: string,
    botId: string
  ): Promise<boolean> {
    // Если новая родительская категория - это сама категория, это цикл
    if (categoryId === newParentId) {
      return true;
    }

    // Проверяем, не является ли категория предком новой родительской категории
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        // Обнаружен цикл
        return true;
      }

      if (currentId === categoryId) {
        // Категория является предком новой родительской категории
        return true;
      }

      visited.add(currentId);

      const category = await this.categoryRepository.findOne({
        where: { id: currentId, botId },
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

    // Создаем карту категорий
    for (const category of categories) {
      const categoryWithChildren = Object.assign(category, { children: [] });
      categoryMap.set(category.id, categoryWithChildren);
    }

    // Строим дерево
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
