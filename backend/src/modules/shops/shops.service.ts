import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ConflictException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, IsNull, Not } from "typeorm";
import * as crypto from "crypto";
import { Shop } from "../../database/entities/shop.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Order } from "../../database/entities/order.entity";
import { Cart } from "../../database/entities/cart.entity";
import { PublicUser } from "../../database/entities/public-user.entity";
import {
  CreateShopDto,
  UpdateShopDto,
  UpdateShopSettingsDto,
  ShopFiltersDto,
} from "./dto/shop.dto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(PublicUser)
    private readonly publicUserRepository: Repository<PublicUser>,
    private readonly activityLogService: ActivityLogService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService
  ) {}

  /**
   * Расшифровать токен бота
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    // Убеждаемся, что ключ имеет правильную длину (32 байта для AES-256)
    const key = crypto.scryptSync(keyString, "salt", 32);

    const [ivHex, encrypted] = encryptedToken.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Создать новый магазин
   */
  async create(createShopDto: CreateShopDto, userId: string): Promise<Shop> {
    const shop = this.shopRepository.create({
      ...createShopDto,
      ownerId: userId,
    });

    const savedShop = await this.shopRepository.save(shop);

    // Логируем создание магазина
    this.activityLogService
      .create({
        type: ActivityType.SHOP_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создан магазин "${savedShop.name}"`,
        userId,
        metadata: {
          shopId: savedShop.id,
          shopName: savedShop.name,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования создания магазина:", error);
      });

    this.logger.log(`Shop created: ${savedShop.id} by user ${userId}`);
    return savedShop;
  }

  /**
   * Получить все магазины пользователя
   */
  async findAll(userId: string, filters?: ShopFiltersDto): Promise<Shop[]> {
    const queryBuilder = this.shopRepository
      .createQueryBuilder("shop")
      .leftJoinAndSelect("shop.bot", "bot")
      .where("shop.ownerId = :userId", { userId })
      .orderBy("shop.updatedAt", "DESC");

    if (filters?.search) {
      queryBuilder.andWhere(
        "(shop.name ILIKE :search OR shop.title ILIKE :search)",
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.hasBot !== undefined) {
      if (filters.hasBot) {
        queryBuilder.andWhere("shop.botId IS NOT NULL");
      } else {
        queryBuilder.andWhere("shop.botId IS NULL");
      }
    }

    return queryBuilder.getMany();
  }

  /**
   * Получить магазин по ID
   */
  async findOne(id: string, userId: string): Promise<Shop> {
    const shop = await this.shopRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    // Проверяем права доступа
    if (shop.ownerId !== userId) {
      throw new ForbiddenException("Нет доступа к этому магазину");
    }


    return shop;
  }

  /**
   * Получить магазин по ID бота
   * @param botId ID бота
   * @param userId ID пользователя (опционально, для проверки владельца)
   */
  async findByBotId(botId: string, userId?: string): Promise<Shop | null> {
    const whereCondition: any = { botId };
    if (userId) {
      whereCondition.ownerId = userId;
    }

    return this.shopRepository.findOne({
      where: whereCondition,
      relations: ["bot"],
    });
  }

  /**
   * Получить магазин по ID для публичного доступа (без проверки владельца)
   */
  async findOnePublic(id: string): Promise<Shop> {
    const shop = await this.shopRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    return shop;
  }

  /**
   * Обновить магазин
   */
  async update(
    id: string,
    updateShopDto: UpdateShopDto,
    userId: string
  ): Promise<Shop> {
    const shop = await this.findOne(id, userId);

    Object.assign(shop, updateShopDto);
    const updatedShop = await this.shopRepository.save(shop);

    // Логируем обновление магазина
    this.activityLogService
      .create({
        type: ActivityType.SHOP_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлен магазин "${updatedShop.name}"`,
        userId,
        metadata: {
          shopId: updatedShop.id,
          shopName: updatedShop.name,
          changes: updateShopDto,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления магазина:", error);
      });

    return updatedShop;
  }

  /**
   * Обновить настройки магазина
   */
  async updateSettings(
    id: string,
    settings: UpdateShopSettingsDto,
    userId: string
  ): Promise<Shop> {
    const shop = await this.findOne(id, userId);


    Object.assign(shop, settings);
    const updatedShop = await this.shopRepository.save(shop);


    // Обновляем команды бота в Telegram если магазин привязан к боту
    // и изменялись настройки buttonTypes или buttonSettings
    if (
      updatedShop.bot &&
      (settings.buttonTypes !== undefined ||
        settings.buttonSettings !== undefined)
    ) {
      try {
        const token = this.decryptToken(updatedShop.bot.token);
        const success = await this.telegramService.setBotCommands(
          token,
          updatedShop.bot,
          updatedShop
        );
        if (success) {
          this.logger.log(
            `Bot commands updated after shop settings change for shop ${updatedShop.id}`
          );
        } else {
          this.logger.error(
            `Failed to update bot commands for shop ${updatedShop.id}`
          );
        }
      } catch (error) {
        this.logger.error(
          "Ошибка обновления команд бота после изменения настроек:",
          error.message
        );
        // Не выбрасываем ошибку, чтобы не блокировать сохранение настроек
      }
    }

    // Логируем обновление настроек
    this.activityLogService
      .create({
        type: ActivityType.SHOP_SETTINGS_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлены настройки магазина "${updatedShop.name}"`,
        userId,
        metadata: {
          shopId: updatedShop.id,
          settings,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления настроек:", error);
      });

    return updatedShop;
  }

  /**
   * Удалить магазин
   */
  async remove(id: string, userId: string): Promise<void> {
    const shop = await this.findOne(id, userId);

    await this.shopRepository.remove(shop);

    // Логируем удаление магазина
    this.activityLogService
      .create({
        type: ActivityType.SHOP_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удален магазин "${shop.name}"`,
        userId,
        metadata: {
          shopId: id,
          shopName: shop.name,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления магазина:", error);
      });

    this.logger.log(`Shop deleted: ${id} by user ${userId}`);
  }

  /**
   * Привязать бота к магазину
   */
  async linkBot(shopId: string, botId: string, userId: string): Promise<Shop> {
    const shop = await this.findOne(shopId, userId);

    // Проверяем, что бот существует и принадлежит пользователю
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    if (bot.ownerId !== userId) {
      throw new ForbiddenException("Нет доступа к этому боту");
    }

    // Проверяем, не привязан ли бот уже к другому магазину
    const existingShop = await this.shopRepository.findOne({
      where: { botId },
    });

    if (existingShop && existingShop.id !== shopId) {
      throw new ConflictException("Этот бот уже привязан к другому магазину");
    }

    // Если к магазину уже привязан другой бот, отвязываем его
    if (shop.botId && shop.botId !== botId) {
      this.logger.log(
        `Unlinking previous bot ${shop.botId} from shop ${shopId}`
      );
    }

    shop.botId = botId;
    shop.bot = bot;
    const updatedShop = await this.shopRepository.save(shop);

    // Обновляем команды бота в Telegram (добавляем /shop)
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.setBotCommands(token, bot, updatedShop);
      this.logger.log(`Bot commands updated after linking shop ${shopId}`);
    } catch (error) {
      this.logger.error("Ошибка обновления команд бота:", error.message);
    }

    // Логируем привязку бота
    this.activityLogService
      .create({
        type: ActivityType.SHOP_BOT_LINKED,
        level: ActivityLevel.SUCCESS,
        message: `Бот @${bot.username} привязан к магазину "${shop.name}"`,
        userId,
        metadata: {
          shopId,
          botId,
          botUsername: bot.username,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования привязки бота:", error);
      });

    this.logger.log(`Bot ${botId} linked to shop ${shopId}`);
    return updatedShop;
  }

  /**
   * Отвязать бота от магазина
   */
  async unlinkBot(shopId: string, userId: string): Promise<Shop> {
    const shop = await this.findOne(shopId, userId);

    if (!shop.botId) {
      throw new BadRequestException("К магазину не привязан бот");
    }

    const previousBotId = shop.botId;
    const previousBotUsername = shop.bot?.username;
    const previousBot = shop.bot;

    shop.botId = null;
    shop.bot = undefined;
    const updatedShop = await this.shopRepository.save(shop);

    // Обновляем команды бота в Telegram (убираем /shop)
    if (previousBot) {
      try {
        const token = this.decryptToken(previousBot.token);
        await this.telegramService.setBotCommands(token, previousBot, null);
        this.logger.log(
          `Bot commands updated after unlinking from shop ${shopId}`
        );
      } catch (error) {
        this.logger.error("Ошибка обновления команд бота:", error.message);
      }
    }

    // Логируем отвязку бота
    this.activityLogService
      .create({
        type: ActivityType.SHOP_BOT_UNLINKED,
        level: ActivityLevel.INFO,
        message: `Бот отвязан от магазина "${shop.name}"`,
        userId,
        metadata: {
          shopId,
          previousBotId,
          previousBotUsername,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования отвязки бота:", error);
      });

    this.logger.log(`Bot unlinked from shop ${shopId}`);
    return updatedShop;
  }

  /**
   * Получить статистику магазина
   */
  async getStats(
    shopId: string,
    userId: string
  ): Promise<{
    productsCount: number;
    categoriesCount: number;
    ordersCount: number;
    activeCartsCount: number;
    publicUsersCount: number;
  }> {
    const shop = await this.findOne(shopId, userId);

    const [
      productsCount,
      categoriesCount,
      ordersCount,
      activeCartsCount,
      publicUsersCount,
    ] = await Promise.all([
      this.productRepository.count({ where: { shopId } }),
      this.categoryRepository.count({ where: { shopId } }),
      this.orderRepository.count({ where: { shopId } }),
      this.cartRepository
        .createQueryBuilder("cart")
        .where("cart.shopId = :shopId", { shopId })
        .andWhere("json_array_length(cart.items) > 0")
        .getCount(),
      this.publicUserRepository.count({ where: { shopId } }),
    ]);

    return {
      productsCount,
      categoriesCount,
      ordersCount,
      activeCartsCount,
      publicUsersCount,
    };
  }

  /**
   * Получить публичные данные магазина
   */
  async getPublicData(shopId: string): Promise<{
    shop: Shop;
    categories: Category[];
  }> {
    const shop = await this.findOnePublic(shopId);

    // Получаем категории магазина (только активные, с иерархией)
    const categories = await this.categoryRepository.find({
      where: { shopId, isActive: true, parentId: IsNull() },
      relations: ["children"],
      order: { sortOrder: "ASC", name: "ASC" },
    });

    // Фильтруем неактивные дочерние категории
    const filterActiveChildren = (cats: Category[]): Category[] => {
      return cats
        .filter((cat) => cat.isActive)
        .map((cat) => {
          if (cat.children) {
            cat.children = filterActiveChildren(cat.children);
          }
          return cat;
        });
    };

    return {
      shop,
      categories: filterActiveChildren(categories),
    };
  }

  /**
   * Получить товары магазина (публичный метод)
   */
  async getPublicProducts(
    shopId: string,
    page: number = 1,
    limit: number = 20,
    categoryId?: string,
    inStock?: boolean,
    search?: string,
    sortBy?: "name-asc" | "name-desc" | "price-asc" | "price-desc"
  ): Promise<{
    products: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Проверяем существование магазина
    await this.findOnePublic(shopId);

    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.category", "category")
      .where("product.shopId = :shopId", { shopId })
      .andWhere("product.isActive = true")
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere("product.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (categoryId) {
      // Получаем все ID подкатегорий
      const subcategoryIds = await this.getAllSubcategoryIds(
        categoryId,
        shopId
      );
      const allCategoryIds = [categoryId, ...subcategoryIds];

      queryBuilder.andWhere("product.categoryId IN (:...categoryIds)", {
        categoryIds: allCategoryIds,
      });
    }

    if (inStock !== undefined) {
      if (inStock) {
        queryBuilder.andWhere("product.stockQuantity > 0");
      } else {
        queryBuilder.andWhere("product.stockQuantity = 0");
      }
    }

    // Сортировка
    switch (sortBy) {
      case "name-asc":
        queryBuilder.orderBy("product.name", "ASC");
        break;
      case "name-desc":
        queryBuilder.orderBy("product.name", "DESC");
        break;
      case "price-asc":
        queryBuilder.orderBy("product.price", "ASC");
        break;
      case "price-desc":
        queryBuilder.orderBy("product.price", "DESC");
        break;
      default:
        queryBuilder.orderBy("product.createdAt", "DESC");
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
   * Получить все ID подкатегорий рекурсивно
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
