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
import { TelegramService } from "../telegram/telegram.service";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { PeriodicTaskService } from "./services/periodic-task.service";

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
    private periodicTaskService: PeriodicTaskService,
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
  // updateBookingSettings удалён - используйте BookingSystemsService
  // getPublicBotForBooking удалён - используйте BookingSystemsService.getPublicData()
  // getPublicBotForBookingBySlug удалён - используйте BookingSystemsService.getBySlug()
  // checkSlugAvailability удалён - используйте BookingSystemsService
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

    // Останавливаем все периодические задачи бота
    try {
      await this.periodicTaskService.cleanupBotTasks(bot.id);
    } catch (error) {
      this.logger.error(
        `Ошибка остановки периодических задач при удалении бота ${bot.id}:`,
        error,
      );
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

    // Останавливаем все периодические задачи бота
    try {
      const cleaned = await this.periodicTaskService.cleanupBotTasks(savedBot.id);
      if (cleaned > 0) {
        this.logger.log(
          `Остановлено ${cleaned} периодических задач при деактивации бота ${savedBot.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка остановки периодических задач при деактивации бота ${savedBot.id}:`,
        error,
      );
    }

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
}
