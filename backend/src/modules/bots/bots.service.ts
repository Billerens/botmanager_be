import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import * as crypto from "crypto";

import { Bot, BotStatus } from "../../database/entities/bot.entity";
import { User } from "../../database/entities/user.entity";
import { Category } from "../../database/entities/category.entity";
import { Product } from "../../database/entities/product.entity";
import { Shop } from "../../database/entities/shop.entity";
import { CreateBotDto, UpdateBotDto } from "./dto/bot.dto";
import { ButtonSettingsDto } from "./dto/command-button-settings.dto";
import { TelegramService } from "../telegram/telegram.service";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { SubdomainService } from "../custom-domains/services/subdomain.service";
import {
  SubdomainStatus,
  SubdomainType,
} from "../custom-domains/enums/domain-status.enum";

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
    private notificationService: NotificationService,
    private activityLogService: ActivityLogService,
    @Inject(forwardRef(() => SubdomainService))
    private readonly subdomainService: SubdomainService
  ) {}

  async create(createBotDto: CreateBotDto, userId: string): Promise<Bot> {
    const { name, description, token } = createBotDto;

    // Проверяем, что токен валидный
    const botInfo = await this.telegramService.getBotInfo(token);
    if (!botInfo) {
      throw new BadRequestException("Неверный токен бота");
    }

    // Проверяем, что бот с таким токеном не существует
    const existingBot = await this.botRepository.findOne({
      where: { token: this.encryptToken(token) },
    });
    if (existingBot) {
      throw new BadRequestException("Бот с таким токеном уже существует");
    }

    // Создаем бота
    const bot = this.botRepository.create({
      name,
      description,
      token: this.encryptToken(token),
      username: botInfo.username,
      ownerId: userId,
      status: BotStatus.INACTIVE,
    });

    const savedBot = await this.botRepository.save(bot);

    // Устанавливаем webhook
    try {
      await this.telegramService.setWebhook(token, savedBot.id);
      savedBot.isWebhookSet = true;
      await this.botRepository.save(savedBot);
    } catch (error) {
      console.error("Ошибка установки webhook:", error);
    }

    // Отправляем уведомление о создании бота
    this.notificationService
      .sendToUser(userId, NotificationType.BOT_CREATED, {
        bot: {
          id: savedBot.id,
          name: savedBot.name,
          username: savedBot.username,
          status: savedBot.status,
        },
      })
      .catch((error) => {
        console.error("Ошибка отправки уведомления о создании бота:", error);
      });

    // Логируем создание бота
    this.activityLogService
      .create({
        type: ActivityType.BOT_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Бот "${savedBot.name}" (${savedBot.username}) создан`,
        userId,
        botId: savedBot.id,
        metadata: {
          botName: savedBot.name,
          botUsername: savedBot.username,
          botStatus: savedBot.status,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования создания бота:", error);
      });

    return savedBot;
  }

  async findAll(userId: string): Promise<Bot[]> {
    return this.botRepository.find({
      where: { ownerId: userId },
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: string, userId: string): Promise<Bot> {
    const bot = await this.botRepository.findOne({
      where: { id },
      relations: ["flows", "flows.nodes"],
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    return bot;
  }

  async update(
    id: string,
    updateBotDto: UpdateBotDto,
    userId: string
  ): Promise<Bot> {
    const bot = await this.findOne(id, userId);
    const oldStatus = bot.status;

    // Обновляем только переданные поля
    Object.assign(bot, updateBotDto);

    const updatedBot = await this.botRepository.save(bot);

    // Проверяем, изменился ли статус
    const statusChanged = oldStatus !== updatedBot.status;

    // Отправляем уведомление об обновлении бота
    this.notificationService
      .sendToUser(userId, NotificationType.BOT_UPDATED, {
        bot: {
          id: updatedBot.id,
          name: updatedBot.name,
          username: updatedBot.username,
          status: updatedBot.status,
        },
        changes: updateBotDto,
      })
      .catch((error) => {
        console.error("Ошибка отправки уведомления об обновлении бота:", error);
      });

    // Если статус изменился, отправляем отдельное уведомление
    if (statusChanged) {
      this.notificationService
        .sendToUser(userId, NotificationType.BOT_STATUS_CHANGED, {
          bot: {
            id: updatedBot.id,
            name: updatedBot.name,
            username: updatedBot.username,
          },
          oldStatus,
          newStatus: updatedBot.status,
        })
        .catch((error) => {
          console.error(
            "Ошибка отправки уведомления об изменении статуса бота:",
            error
          );
        });
    }

    // Логируем обновление бота
    this.activityLogService
      .create({
        type: ActivityType.BOT_UPDATED,
        level: ActivityLevel.INFO,
        message: `Бот "${updatedBot.name}" обновлен`,
        userId,
        botId: updatedBot.id,
        metadata: {
          botName: updatedBot.name,
          changes: updateBotDto,
          statusChanged,
          oldStatus: statusChanged ? oldStatus : undefined,
          newStatus: statusChanged ? updatedBot.status : undefined,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования обновления бота:", error);
      });

    return updatedBot;
  }

  // updateShopSettings удалён - используйте ShopsService.update()

  async updateBookingSettings(
    id: string,
    bookingSettings: {
      slug?: string;
      isBookingEnabled?: boolean;
      bookingTitle?: string;
      bookingDescription?: string;
      bookingLogoUrl?: string;
      bookingCustomStyles?: string;
      bookingButtonTypes?: string[];
      bookingButtonSettings?: ButtonSettingsDto;
      bookingSettings?: any;
    },
    userId: string
  ): Promise<Bot> {
    const bot = await this.findOne(id, userId);

    // Валидация Menu Button конфликта
    this.validateMenuButtonConflict(
      bot,
      bookingSettings.bookingButtonTypes,
      "booking"
    );

    // Обновляем настройки бронирования
    Object.assign(bot, bookingSettings);

    // Если бронирование отключается, очищаем связанные поля
    if (bookingSettings.isBookingEnabled === false) {
      bot.bookingTitle = null;
      bot.bookingDescription = null;
      bot.bookingLogoUrl = null;
      bot.bookingCustomStyles = null;
      bot.bookingButtonTypes = null;
      bot.bookingButtonSettings = null;
    }

    const savedBot = await this.botRepository.save(bot);

    // Обновляем команды бота в Telegram
    try {
      const token = this.decryptToken(bot.token);
      // Получаем привязанный магазин для обновления команд
      const shop = await this.shopRepository.findOne({
        where: { botId: savedBot.id },
      });
      await this.telegramService.setBotCommands(token, savedBot, shop);
    } catch (error) {
      console.error("Ошибка обновления команд бота:", error.message);
    }

    // Логируем изменение настроек бронирования
    this.activityLogService
      .create({
        type: ActivityType.BOT_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлены настройки бронирования для бота "${savedBot.name}"`,
        userId,
        botId: savedBot.id,
        metadata: {
          botName: savedBot.name,
          action: "booking_settings_update",
          changes: bookingSettings,
        },
      })
      .catch((error) => {
        console.error(
          "Ошибка логирования изменения настроек бронирования:",
          error
        );
      });

    return savedBot;
  }

  /**
   * Получить публичные данные бота для бронирования (без авторизации)
   */
  async getPublicBotForBooking(botId: string): Promise<any> {
    const bot = await this.botRepository.findOne({
      where: {
        id: botId,
        status: BotStatus.ACTIVE,
        isBookingEnabled: true,
      },
      relations: ["specialists", "specialists.services"],
    });

    if (!bot) {
      return null;
    }

    return this.formatPublicBotForBooking(bot);
  }

  /**
   * Получить данные бота для бронирования по slug
   * Используется для публичных субдоменов: {slug}.booking.botmanagertest.online
   */
  async getPublicBotForBookingBySlug(slug: string): Promise<any> {
    const normalizedSlug = slug.toLowerCase().trim();

    const bot = await this.botRepository.findOne({
      where: {
        slug: normalizedSlug,
        status: BotStatus.ACTIVE,
        isBookingEnabled: true,
      },
      relations: ["specialists", "specialists.services"],
    });

    if (!bot) {
      return null;
    }

    return this.formatPublicBotForBooking(bot);
  }

  /**
   * Форматирование данных бота для публичного бронирования
   */
  private formatPublicBotForBooking(bot: Bot): any {
    return {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      bookingTitle: bot.bookingTitle || bot.name,
      bookingDescription: bot.bookingDescription || bot.description,
      bookingLogoUrl: bot.bookingLogoUrl,
      bookingCustomStyles: bot.bookingCustomStyles,
      specialists: bot.specialists?.filter((s) => s.isActive) || [],
      // Настройки браузерного доступа
      bookingBrowserAccessEnabled: bot.bookingBrowserAccessEnabled ?? false,
    };
  }

  /**
   * Проверить доступность slug для бота
   * @param slug - проверяемый slug
   * @param excludeId - ID бота для исключения (при редактировании)
   */
  async checkSlugAvailability(
    slug: string,
    excludeId?: string
  ): Promise<{ available: boolean; slug: string; message?: string }> {
    // Нормализуем slug
    const normalizedSlug = this.normalizeSlug(slug);

    // Валидация формата slug
    if (!this.isValidSlug(normalizedSlug)) {
      return {
        available: false,
        slug: normalizedSlug,
        message:
          "Slug может содержать только латинские буквы, цифры и дефисы (2-50 символов)",
      };
    }

    // Проверяем только в таблице bots
    // (slug уникален в рамках типа: my-shop.shops.* и my-shop.booking.* - разные URL)
    const botExists = await this.botRepository.findOne({
      where: excludeId
        ? { slug: normalizedSlug, id: Not(excludeId) }
        : { slug: normalizedSlug },
      select: ["id"],
    });

    const isAvailable = !botExists;

    return {
      available: isAvailable,
      slug: normalizedSlug,
      message: isAvailable ? "Slug доступен" : "Этот slug уже занят",
    };
  }

  /**
   * Нормализация slug
   */
  private normalizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Валидация формата slug
   */
  private isValidSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{1,2}$/;
    return slugRegex.test(slug);
  }

  // Legacy shop методы удалены - используйте ShopsService
  // getPublicBotForShop -> ShopsService.getPublicData
  // getPublicShopProducts -> ShopsService.getPublicProducts

  async remove(id: string, userId: string): Promise<void> {
    const bot = await this.findOne(id, userId);
    const botData = {
      id: bot.id,
      name: bot.name,
      username: bot.username,
    };

    // Удаляем webhook
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.deleteWebhook(token);
    } catch (error) {
      console.error("Ошибка удаления webhook:", error);
    }

    // Отвязываем activity_logs от бота перед удалением
    // Это необходимо для обхода foreign key constraint
    try {
      await this.activityLogService.unlinkFromBot(bot.id);
    } catch (error) {
      console.error("Ошибка отвязки activity_logs от бота:", error);
    }

    await this.botRepository.remove(bot);

    // Отправляем уведомление об удалении бота
    this.notificationService
      .sendToUser(userId, NotificationType.BOT_DELETED, {
        bot: botData,
      })
      .catch((error) => {
        console.error("Ошибка отправки уведомления об удалении бота:", error);
      });

    // Логируем удаление бота
    this.activityLogService
      .create({
        type: ActivityType.BOT_DELETED,
        level: ActivityLevel.WARNING,
        message: `Бот "${botData.name}" (${botData.username}) удален`,
        userId,
        botId: botData.id,
        metadata: {
          botName: botData.name,
          botUsername: botData.username,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования удаления бота:", error);
      });
  }

  async activate(id: string, userId: string): Promise<Bot> {
    const bot = await this.findOne(id, userId);

    if (bot.status === BotStatus.ACTIVE) {
      throw new BadRequestException("Бот уже активен");
    }

    // Проверяем webhook
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.setWebhook(token, bot.id);
      bot.isWebhookSet = true;
    } catch (error) {
      bot.lastError = error.message;
      bot.lastErrorAt = new Date();
      bot.status = BotStatus.ERROR;
      await this.botRepository.save(bot);
      throw new BadRequestException(`Ошибка активации бота: ${error.message}`);
    }

    const oldStatus = bot.status;
    bot.status = BotStatus.ACTIVE;
    bot.lastError = null;
    bot.lastErrorAt = null;

    const savedBot = await this.botRepository.save(bot);

    // Отправляем уведомление об изменении статуса
    this.notificationService
      .sendToUser(userId, NotificationType.BOT_STATUS_CHANGED, {
        bot: {
          id: savedBot.id,
          name: savedBot.name,
          username: savedBot.username,
        },
        oldStatus,
        newStatus: savedBot.status,
      })
      .catch((error) => {
        console.error(
          "Ошибка отправки уведомления об изменении статуса бота:",
          error
        );
      });

    // Логируем активацию бота
    this.activityLogService
      .create({
        type: ActivityType.BOT_ACTIVATED,
        level: ActivityLevel.SUCCESS,
        message: `Бот "${savedBot.name}" активирован`,
        userId,
        botId: savedBot.id,
        metadata: {
          botName: savedBot.name,
          botUsername: savedBot.username,
          oldStatus,
          newStatus: savedBot.status,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования активации бота:", error);
      });

    return savedBot;
  }

  async deactivate(id: string, userId: string): Promise<Bot> {
    const bot = await this.findOne(id, userId);

    if (bot.status === BotStatus.INACTIVE) {
      throw new BadRequestException("Бот уже неактивен");
    }

    // Удаляем webhook
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.deleteWebhook(token);
      bot.isWebhookSet = false;
    } catch (error) {
      console.error("Ошибка удаления webhook:", error);
    }

    const oldStatus = bot.status;
    bot.status = BotStatus.INACTIVE;

    const savedBot = await this.botRepository.save(bot);

    // Отправляем уведомление об изменении статуса
    this.notificationService
      .sendToUser(userId, NotificationType.BOT_STATUS_CHANGED, {
        bot: {
          id: savedBot.id,
          name: savedBot.name,
          username: savedBot.username,
        },
        oldStatus,
        newStatus: savedBot.status,
      })
      .catch((error) => {
        console.error(
          "Ошибка отправки уведомления об изменении статуса бота:",
          error
        );
      });

    // Логируем деактивацию бота
    this.activityLogService
      .create({
        type: ActivityType.BOT_DEACTIVATED,
        level: ActivityLevel.WARNING,
        message: `Бот "${savedBot.name}" деактивирован`,
        userId,
        botId: savedBot.id,
        metadata: {
          botName: savedBot.name,
          botUsername: savedBot.username,
          oldStatus,
          newStatus: savedBot.status,
        },
      })
      .catch((error) => {
        console.error("Ошибка логирования деактивации бота:", error);
      });

    return savedBot;
  }

  async getStats(
    id: string,
    userId: string
  ): Promise<{
    totalUsers: number;
    totalMessages: number;
    totalLeads: number;
    status: BotStatus;
    lastError: string | null;
    lastErrorAt: Date | null;
  }> {
    const bot = await this.botRepository.findOne({
      where: { id },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    return {
      totalUsers: bot.totalUsers,
      totalMessages: bot.totalMessages,
      totalLeads: bot.totalLeads,
      status: bot.status,
      lastError: bot.lastError,
      lastErrorAt: bot.lastErrorAt,
    };
  }

  async updateStats(
    id: string,
    stats: {
      totalUsers?: number;
      totalMessages?: number;
      totalLeads?: number;
    }
  ): Promise<void> {
    await this.botRepository.update(id, stats);
  }

  async findByToken(encryptedToken: string): Promise<Bot | null> {
    return this.botRepository.findOne({
      where: { token: encryptedToken },
    });
  }

  async findById(id: string): Promise<Bot | null> {
    return this.botRepository.findOne({
      where: { id },
    });
  }

  async getBotByTelegramId(telegramBotId: string): Promise<Bot | null> {
    // Здесь нужно найти бота по Telegram ID
    // Это требует дополнительной логики, так как мы храним только username
    return null;
  }

  // Шифрование токена
  private encryptToken(token: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    // Убеждаемся, что ключ имеет правильную длину (32 байта для AES-256)
    const key = crypto.scryptSync(keyString, "salt", 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
  }

  // Расшифровка токена
  decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    // Убеждаемся, что ключ имеет правильную длину (32 байта для AES-256)
    const key = crypto.scryptSync(keyString, "salt", 32);

    const parts = encryptedToken.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Валидирует конфликт Menu Button между магазином и бронированием
   * @param bot - объект бота
   * @param newButtonTypes - новые типы кнопок для проверки
   * @param module - модуль, для которого проверяется конфликт ('shop' или 'booking')
   */
  private validateMenuButtonConflict(
    bot: Bot,
    newButtonTypes: string[] | undefined,
    module: "shop" | "booking"
  ): void {
    // Если новые типы кнопок не переданы, пропускаем валидацию
    if (!newButtonTypes) {
      return;
    }

    // Проверяем, пытается ли пользователь включить menu_button
    const isTryingToEnableMenuButton = newButtonTypes.includes("menu_button");

    if (!isTryingToEnableMenuButton) {
      return; // Если не пытается включить menu_button, конфликта нет
    }

    // Проверяем конфликт в зависимости от модуля
    // Shop теперь отдельная сущность - проверка конфликта с магазином
    // выполняется в ShopsService при привязке к боту
    if (module === "booking") {
      // Проверку для booking оставляем как есть
      // Конфликт с Shop проверяется при привязке магазина к боту через ShopsService
    }
  }

  // =====================================================
  // МЕТОДЫ УПРАВЛЕНИЯ СУБДОМЕНАМИ (BOOKING)
  // =====================================================

  /**
   * Обновить slug бота (субдомен для бронирования)
   */
  async updateSlug(
    botId: string,
    newSlug: string | null,
    userId: string
  ): Promise<Bot> {
    const bot = await this.findOne(botId, userId);
    const oldSlug = bot.slug;

    // Если slug не изменился - ничего не делаем
    if (oldSlug === newSlug) {
      return bot;
    }

    // Если устанавливаем новый slug
    if (newSlug) {
      // Проверяем доступность
      const availability = await this.checkSlugAvailability(newSlug, botId);
      if (!availability.available) {
        throw new BadRequestException(availability.message);
      }

      // Если был старый slug - удаляем старый субдомен
      if (oldSlug) {
        this.logger.log(
          `Removing old subdomain for bot ${botId}: ${oldSlug}.booking`
        );
        await this.subdomainService.remove(oldSlug, SubdomainType.BOOKING);
      }

      // Регистрируем новый субдомен
      this.logger.log(
        `Registering new subdomain for bot ${botId}: ${newSlug}.booking`
      );

      bot.slug = availability.slug;
      bot.subdomainStatus = SubdomainStatus.PENDING;
      bot.subdomainError = null;
      bot.subdomainActivatedAt = null;
      bot.subdomainUrl = null;

      await this.botRepository.save(bot);

      // Регистрируем субдомен (асинхронно)
      this.registerSubdomainAsync(bot);

      // Логируем
      this.activityLogService
        .create({
          type: ActivityType.BOT_UPDATED,
          level: ActivityLevel.INFO,
          message: `Установлен slug "${availability.slug}" для бронирования бота "${bot.name}"`,
          userId,
          metadata: {
            botId,
            oldSlug,
            newSlug: availability.slug,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования изменения slug:", error);
        });
    }
    // Если удаляем slug
    else if (oldSlug) {
      this.logger.log(
        `Removing subdomain for bot ${botId}: ${oldSlug}.booking`
      );

      bot.slug = null;
      bot.subdomainStatus = SubdomainStatus.REMOVING;
      bot.subdomainError = null;

      await this.botRepository.save(bot);

      // Удаляем субдомен
      const removed = await this.subdomainService.remove(
        oldSlug,
        SubdomainType.BOOKING
      );

      bot.subdomainStatus = null;
      bot.subdomainUrl = null;
      bot.subdomainActivatedAt = null;

      if (!removed) {
        this.logger.warn(`Failed to fully remove subdomain for bot ${botId}`);
      }

      await this.botRepository.save(bot);

      // Логируем
      this.activityLogService
        .create({
          type: ActivityType.BOT_UPDATED,
          level: ActivityLevel.INFO,
          message: `Удалён slug "${oldSlug}" бронирования бота "${bot.name}"`,
          userId,
          metadata: {
            botId,
            removedSlug: oldSlug,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования удаления slug:", error);
        });
    }

    return this.botRepository.findOne({ where: { id: botId } });
  }

  /**
   * Асинхронная регистрация субдомена
   */
  private async registerSubdomainAsync(bot: Bot): Promise<void> {
    try {
      bot.subdomainStatus = SubdomainStatus.DNS_CREATING;
      await this.botRepository.save(bot);

      const result = await this.subdomainService.register({
        slug: bot.slug,
        type: SubdomainType.BOOKING,
        targetId: bot.id,
      });

      if (result.success) {
        bot.subdomainStatus = result.status;
        bot.subdomainUrl = result.fullDomain;

        // Ждём активации SSL (в фоне)
        this.waitForSubdomainActivation(bot);
      } else {
        bot.subdomainStatus = result.status;
        bot.subdomainError = result.error;
        this.logger.error(
          `Failed to register subdomain for bot ${bot.id}: ${result.error}`
        );
      }

      await this.botRepository.save(bot);
    } catch (error) {
      this.logger.error(
        `Error registering subdomain for bot ${bot.id}: ${error.message}`
      );
      bot.subdomainStatus = SubdomainStatus.ERROR;
      bot.subdomainError = error.message;
      await this.botRepository.save(bot);
    }
  }

  /**
   * Ожидание активации субдомена (SSL)
   */
  private async waitForSubdomainActivation(bot: Bot): Promise<void> {
    try {
      const activated = await this.subdomainService.waitForActivation(
        bot.slug,
        SubdomainType.BOOKING,
        120000 // 2 минуты
      );

      if (activated) {
        bot.subdomainStatus = SubdomainStatus.ACTIVE;
        bot.subdomainActivatedAt = new Date();
        bot.subdomainError = null;
        this.logger.log(
          `Subdomain activated for bot ${bot.id}: ${bot.subdomainUrl}`
        );
      } else {
        bot.subdomainStatus = SubdomainStatus.ACTIVATING;
        this.logger.warn(
          `Subdomain not ready for bot ${bot.id}, waiting for DNS propagation and SSL`
        );
      }

      await this.botRepository.save(bot);
    } catch (error) {
      this.logger.error(
        `Error waiting for subdomain activation for bot ${bot.id}: ${error.message}`
      );
    }
  }

  /**
   * Получить статус субдомена бота
   */
  async getSubdomainStatus(
    botId: string,
    userId: string
  ): Promise<{
    slug: string | null;
    status: SubdomainStatus | null;
    url: string | null;
    error: string | null;
    activatedAt: Date | null;
    estimatedWaitMessage: string | null;
  }> {
    const bot = await this.findOne(botId, userId);

    let estimatedWaitMessage: string | null = null;
    if (
      bot.subdomainStatus === SubdomainStatus.PENDING ||
      bot.subdomainStatus === SubdomainStatus.DNS_CREATING ||
      bot.subdomainStatus === SubdomainStatus.ACTIVATING
    ) {
      estimatedWaitMessage =
        "Субдомен активируется. Время ожидания может варьироваться от 30 секунд до нескольких минут.";
    }

    return {
      slug: bot.slug || null,
      status: bot.subdomainStatus || null,
      url: bot.subdomainUrl ? `https://${bot.subdomainUrl}` : null,
      error: bot.subdomainError || null,
      activatedAt: bot.subdomainActivatedAt || null,
      estimatedWaitMessage,
    };
  }

  /**
   * Повторить активацию субдомена
   */
  async retrySubdomainActivation(botId: string, userId: string): Promise<Bot> {
    const bot = await this.findOne(botId, userId);

    if (!bot.slug) {
      throw new BadRequestException("У бота не установлен slug");
    }

    if (bot.subdomainStatus === SubdomainStatus.ACTIVE) {
      throw new BadRequestException("Субдомен уже активен");
    }

    this.logger.log(`Retrying subdomain activation for bot ${botId}`);

    bot.subdomainStatus = SubdomainStatus.PENDING;
    bot.subdomainError = null;
    await this.botRepository.save(bot);

    // Запускаем регистрацию заново
    this.registerSubdomainAsync(bot);

    return bot;
  }
}
