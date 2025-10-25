import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";

import { Bot, BotStatus } from "../../database/entities/bot.entity";
import { User } from "../../database/entities/user.entity";
import { CreateBotDto, UpdateBotDto } from "./dto/bot.dto";
import { ButtonSettingsDto } from "./dto/command-button-settings.dto";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService
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
      where: { id, ownerId: userId },
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

    // Обновляем только переданные поля
    Object.assign(bot, updateBotDto);

    return this.botRepository.save(bot);
  }

  async updateShopSettings(
    id: string,
    shopSettings: {
      isShop?: boolean;
      shopLogoUrl?: string;
      shopTitle?: string;
      shopDescription?: string;
      shopCustomStyles?: string;
      shopButtonTypes?: string[];
      shopButtonSettings?: ButtonSettingsDto;
    },
    userId: string
  ): Promise<Bot> {
    const bot = await this.findOne(id, userId);

    // Валидация Menu Button конфликта
    this.validateMenuButtonConflict(bot, shopSettings.shopButtonTypes, "shop");

    // Обновляем настройки магазина
    Object.assign(bot, shopSettings);

    // Если магазин отключается, очищаем связанные поля
    if (shopSettings.isShop === false) {
      bot.shopLogoUrl = null;
      bot.shopTitle = null;
      bot.shopDescription = null;
      bot.shopCustomStyles = null;
      bot.shopButtonTypes = null;
      bot.shopButtonSettings = null;
    }

    const savedBot = await this.botRepository.save(bot);

    // Обновляем команды бота в Telegram
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.setBotCommands(token, savedBot);
    } catch (error) {
      console.error("Ошибка обновления команд бота:", error.message);
    }

    return savedBot;
  }

  async updateBookingSettings(
    id: string,
    bookingSettings: {
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
      await this.telegramService.setBotCommands(token, savedBot);
    } catch (error) {
      console.error("Ошибка обновления команд бота:", error.message);
    }

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

    return {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      bookingTitle: bot.bookingTitle || bot.name,
      bookingDescription: bot.bookingDescription || bot.description,
      bookingLogoUrl: bot.bookingLogoUrl,
      bookingCustomStyles: bot.bookingCustomStyles,
      specialists: bot.specialists?.filter((s) => s.isActive) || [],
    };
  }
  async getPublicBotForShop(botId: string): Promise<any> {
    const bot = await this.botRepository.findOne({
      where: {
        id: botId,
        status: BotStatus.ACTIVE,
        isShop: true,
      },
      relations: ["products"],
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден или магазин не активен");
    }

    // Возвращаем только публичные данные, необходимые для магазина
    return {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      shopTitle: bot.shopTitle,
      shopDescription: bot.shopDescription,
      shopLogoUrl: bot.shopLogoUrl,
      shopCustomStyles: bot.shopCustomStyles,
      shopButtonTypes: bot.shopButtonTypes,
      shopButtonSettings: bot.shopButtonSettings,
      shopUrl: bot.shopUrl,
      products: bot.products?.filter((product) => product.isActive) || [],
    };
  }

  async remove(id: string, userId: string): Promise<void> {
    const bot = await this.findOne(id, userId);

    // Удаляем webhook
    try {
      const token = this.decryptToken(bot.token);
      await this.telegramService.deleteWebhook(token);
    } catch (error) {
      console.error("Ошибка удаления webhook:", error);
    }

    await this.botRepository.remove(bot);
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

    bot.status = BotStatus.ACTIVE;
    bot.lastError = null;
    bot.lastErrorAt = null;

    return this.botRepository.save(bot);
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

    bot.status = BotStatus.INACTIVE;

    return this.botRepository.save(bot);
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
    const bot = await this.findOne(id, userId);

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
    if (module === "shop") {
      // Если пытаемся включить menu_button для магазина, проверяем бронирование
      if (
        bot.isBookingEnabled &&
        bot.bookingButtonTypes?.includes("menu_button")
      ) {
        throw new BadRequestException(
          "Menu Button уже включен для системы бронирования. В Telegram боте может быть только одна Menu Button. Сначала отключите Menu Button в настройках бронирования."
        );
      }
    } else if (module === "booking") {
      // Если пытаемся включить menu_button для бронирования, проверяем магазин
      if (bot.isShop && bot.shopButtonTypes?.includes("menu_button")) {
        throw new BadRequestException(
          "Menu Button уже включен для магазина. В Telegram боте может быть только одна Menu Button. Сначала отключите Menu Button в настройках магазина."
        );
      }
    }
  }
}
