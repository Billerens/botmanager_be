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
import { Repository, Not } from "typeorm";
import * as crypto from "crypto";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { Service } from "../../database/entities/service.entity";
import { Booking, BookingStatus } from "../../database/entities/booking.entity";
import {
  CreateBookingSystemDto,
  UpdateBookingSystemDto,
  UpdateBookingSystemSettingsDto,
} from "./dto/booking-system.dto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { TelegramService } from "../telegram/telegram.service";
import { SubdomainService } from "../custom-domains/services/subdomain.service";
import {
  SubdomainStatus,
  SubdomainType,
} from "../custom-domains/enums/domain-status.enum";

export interface BookingSystemFilters {
  search?: string;
  hasBot?: boolean;
}

@Injectable()
export class BookingSystemsService {
  private readonly logger = new Logger(BookingSystemsService.name);

  constructor(
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Specialist)
    private readonly specialistRepository: Repository<Specialist>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly activityLogService: ActivityLogService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => SubdomainService))
    private readonly subdomainService: SubdomainService
  ) {}

  /**
   * Получить связанный магазин по botId
   */
  private async getLinkedShopByBotId(botId: string): Promise<Shop | null> {
    return this.shopRepository.findOne({
      where: { botId },
    });
  }

  /**
   * Расшифровать токен бота
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    const key = crypto.scryptSync(keyString, "salt", 32);

    const [ivHex, encrypted] = encryptedToken.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Создать новую систему бронирования
   */
  async create(
    createDto: CreateBookingSystemDto,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = this.bookingSystemRepository.create({
      ...createDto,
      ownerId: userId,
    });

    const saved = await this.bookingSystemRepository.save(bookingSystem);

    // Логируем создание
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_CREATED,
        level: ActivityLevel.SUCCESS,
        message: `Создана система бронирования "${saved.name}"`,
        userId,
        metadata: {
          bookingSystemId: saved.id,
          bookingSystemName: saved.name,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка логирования создания системы бронирования:",
          error
        );
      });

    return saved;
  }

  /**
   * Получить все системы бронирования пользователя
   */
  async findAll(
    userId: string,
    filters?: BookingSystemFilters
  ): Promise<BookingSystem[]> {
    const queryBuilder = this.bookingSystemRepository
      .createQueryBuilder("bookingSystem")
      .leftJoinAndSelect("bookingSystem.bot", "bot")
      .where("bookingSystem.ownerId = :userId", { userId })
      .orderBy("bookingSystem.updatedAt", "DESC");

    if (filters?.search) {
      queryBuilder.andWhere(
        "(bookingSystem.name ILIKE :search OR bookingSystem.title ILIKE :search)",
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.hasBot !== undefined) {
      if (filters.hasBot) {
        queryBuilder.andWhere("bookingSystem.botId IS NOT NULL");
      } else {
        queryBuilder.andWhere("bookingSystem.botId IS NULL");
      }
    }

    return queryBuilder.getMany();
  }

  /**
   * Получить систему бронирования по ID
   */
  async findOne(id: string, userId: string): Promise<BookingSystem> {
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    if (!bookingSystem) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    if (bookingSystem.ownerId !== userId) {
      throw new ForbiddenException("Нет доступа к этой системе бронирования");
    }

    return bookingSystem;
  }

  /**
   * Получить систему бронирования по ID бота
   */
  async findByBotId(
    botId: string,
    userId?: string
  ): Promise<BookingSystem | null> {
    const whereCondition: any = { botId };
    if (userId) {
      whereCondition.ownerId = userId;
    }

    return this.bookingSystemRepository.findOne({
      where: whereCondition,
      relations: ["bot"],
    });
  }

  /**
   * Получить систему бронирования по ID для публичного доступа
   */
  async findOnePublic(id: string): Promise<BookingSystem> {
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id },
      relations: ["bot"],
    });

    if (!bookingSystem) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    return bookingSystem;
  }

  /**
   * Получить систему бронирования по slug
   */
  async findOneBySlug(slug: string): Promise<BookingSystem> {
    const normalizedSlug = slug.toLowerCase().trim();

    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { slug: normalizedSlug },
      relations: ["bot"],
    });

    if (!bookingSystem) {
      throw new NotFoundException(
        `Система бронирования с slug "${slug}" не найдена`
      );
    }

    return bookingSystem;
  }

  /**
   * Проверить доступность slug
   */
  async checkSlugAvailability(
    slug: string,
    excludeId?: string
  ): Promise<{ available: boolean; slug: string; message?: string }> {
    const normalizedSlug = this.normalizeSlug(slug);

    if (!this.isValidSlug(normalizedSlug)) {
      return {
        available: false,
        slug: normalizedSlug,
        message:
          "Slug может содержать только латинские буквы, цифры и дефисы (2-50 символов)",
      };
    }

    const exists = await this.bookingSystemRepository.findOne({
      where: excludeId
        ? { slug: normalizedSlug, id: Not(excludeId) }
        : { slug: normalizedSlug },
      select: ["id"],
    });

    const isAvailable = !exists;

    return {
      available: isAvailable,
      slug: normalizedSlug,
      message: isAvailable ? "Slug доступен" : "Этот slug уже занят",
    };
  }

  private normalizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private isValidSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{1,2}$/;
    return slugRegex.test(slug);
  }

  /**
   * Обновить систему бронирования
   */
  async update(
    id: string,
    updateDto: UpdateBookingSystemDto,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(id, userId);

    Object.assign(bookingSystem, updateDto);
    const updated = await this.bookingSystemRepository.save(bookingSystem);

    // Логируем обновление
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлена система бронирования "${updated.name}"`,
        userId,
        metadata: {
          bookingSystemId: updated.id,
          bookingSystemName: updated.name,
          changes: updateDto,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка логирования обновления системы бронирования:",
          error
        );
      });

    return updated;
  }

  /**
   * Обновить slug и управлять субдоменом
   */
  async updateSlug(
    id: string,
    newSlug: string | null,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(id, userId);
    const oldSlug = bookingSystem.slug;

    if (oldSlug === newSlug) {
      return bookingSystem;
    }

    if (newSlug) {
      const availability = await this.checkSlugAvailability(newSlug, id);
      if (!availability.available) {
        throw new BadRequestException(availability.message);
      }

      if (oldSlug) {
        this.logger.log(
          `Removing old subdomain for booking system ${id}: ${oldSlug}.booking`
        );
        await this.subdomainService.remove(oldSlug, SubdomainType.BOOKING);
      }

      this.logger.log(
        `Registering new subdomain for booking system ${id}: ${newSlug}.booking`
      );

      bookingSystem.slug = availability.slug;
      bookingSystem.subdomainStatus = SubdomainStatus.PENDING;
      bookingSystem.subdomainError = null;
      bookingSystem.subdomainActivatedAt = null;
      bookingSystem.subdomainUrl = null;

      await this.bookingSystemRepository.save(bookingSystem);

      this.registerSubdomainAsync(bookingSystem);

      this.activityLogService
        .create({
          type: ActivityType.BOOKING_SYSTEM_UPDATED,
          level: ActivityLevel.INFO,
          message: `Установлен slug "${availability.slug}" для системы бронирования "${bookingSystem.name}"`,
          userId,
          metadata: {
            bookingSystemId: id,
            oldSlug,
            newSlug: availability.slug,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования изменения slug:", error);
        });
    } else if (oldSlug) {
      this.logger.log(
        `Removing subdomain for booking system ${id}: ${oldSlug}.booking`
      );

      bookingSystem.slug = null;
      bookingSystem.subdomainStatus = SubdomainStatus.REMOVING;
      bookingSystem.subdomainError = null;

      await this.bookingSystemRepository.save(bookingSystem);

      await this.subdomainService.remove(oldSlug, SubdomainType.BOOKING);

      bookingSystem.subdomainStatus = null;
      bookingSystem.subdomainUrl = null;
      bookingSystem.subdomainActivatedAt = null;

      await this.bookingSystemRepository.save(bookingSystem);

      this.activityLogService
        .create({
          type: ActivityType.BOOKING_SYSTEM_UPDATED,
          level: ActivityLevel.INFO,
          message: `Удалён slug "${oldSlug}" системы бронирования "${bookingSystem.name}"`,
          userId,
          metadata: {
            bookingSystemId: id,
            removedSlug: oldSlug,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования удаления slug:", error);
        });
    }

    return this.bookingSystemRepository.findOne({
      where: { id },
      relations: ["bot"],
    });
  }

  private async registerSubdomainAsync(
    bookingSystem: BookingSystem
  ): Promise<void> {
    try {
      bookingSystem.subdomainStatus = SubdomainStatus.DNS_CREATING;
      await this.bookingSystemRepository.save(bookingSystem);

      const result = await this.subdomainService.register({
        slug: bookingSystem.slug,
        type: SubdomainType.BOOKING,
        targetId: bookingSystem.id,
      });

      if (result.success) {
        bookingSystem.subdomainStatus = result.status;
        bookingSystem.subdomainUrl = result.fullDomain;
        this.waitForSubdomainActivation(bookingSystem);
      } else {
        bookingSystem.subdomainStatus = result.status;
        bookingSystem.subdomainError = result.error;
        this.logger.error(
          `Failed to register subdomain for booking system ${bookingSystem.id}: ${result.error}`
        );
      }

      await this.bookingSystemRepository.save(bookingSystem);
    } catch (error) {
      this.logger.error(
        `Error registering subdomain for booking system ${bookingSystem.id}: ${error.message}`
      );
      bookingSystem.subdomainStatus = SubdomainStatus.ERROR;
      bookingSystem.subdomainError = error.message;
      await this.bookingSystemRepository.save(bookingSystem);
    }
  }

  private async waitForSubdomainActivation(
    bookingSystem: BookingSystem
  ): Promise<void> {
    try {
      const activated = await this.subdomainService.waitForActivation(
        bookingSystem.slug,
        SubdomainType.BOOKING,
        120000
      );

      if (activated) {
        bookingSystem.subdomainStatus = SubdomainStatus.ACTIVE;
        bookingSystem.subdomainActivatedAt = new Date();
        bookingSystem.subdomainError = null;
        this.logger.log(
          `Subdomain activated for booking system ${bookingSystem.id}: ${bookingSystem.subdomainUrl}`
        );
      } else {
        bookingSystem.subdomainStatus = SubdomainStatus.ACTIVATING;
        this.logger.warn(
          `Subdomain not ready for booking system ${bookingSystem.id}, waiting for DNS propagation and SSL`
        );
      }

      await this.bookingSystemRepository.save(bookingSystem);
    } catch (error) {
      this.logger.error(
        `Error waiting for subdomain activation for booking system ${bookingSystem.id}: ${error.message}`
      );
    }
  }

  /**
   * Получить статус субдомена
   */
  async getSubdomainStatus(id: string, userId: string) {
    const bookingSystem = await this.findOne(id, userId);

    return this.subdomainService.buildStatusData({
      slug: bookingSystem.slug || null,
      status: bookingSystem.subdomainStatus || null,
      url: bookingSystem.subdomainUrl || null,
      error: bookingSystem.subdomainError || null,
      activatedAt: bookingSystem.subdomainActivatedAt || null,
    });
  }

  /**
   * Повторить регистрацию субдомена
   */
  async retrySubdomainRegistration(
    id: string,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(id, userId);

    if (!bookingSystem.slug) {
      throw new BadRequestException(
        "У системы бронирования не установлен slug"
      );
    }

    if (bookingSystem.subdomainStatus !== SubdomainStatus.ERROR) {
      throw new BadRequestException("Повтор возможен только после ошибки");
    }

    bookingSystem.subdomainStatus = SubdomainStatus.PENDING;
    bookingSystem.subdomainError = null;
    await this.bookingSystemRepository.save(bookingSystem);

    this.registerSubdomainAsync(bookingSystem);

    return bookingSystem;
  }

  /**
   * Удалить субдомен системы бронирования
   */
  async removeSubdomain(id: string, userId: string): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(id, userId);

    if (!bookingSystem.slug) {
      throw new BadRequestException(
        "У системы бронирования не установлен субдомен"
      );
    }

    const oldSlug = bookingSystem.slug;

    // Устанавливаем статус удаления
    bookingSystem.subdomainStatus = SubdomainStatus.REMOVING;
    await this.bookingSystemRepository.save(bookingSystem);

    // Удаляем субдомен
    await this.subdomainService.remove(oldSlug, SubdomainType.BOOKING);

    // Обновляем запись
    bookingSystem.slug = null;
    bookingSystem.subdomainStatus = null;
    bookingSystem.subdomainUrl = null;
    bookingSystem.subdomainActivatedAt = null;
    bookingSystem.subdomainError = null;

    const updated = await this.bookingSystemRepository.save(bookingSystem);

    // Логируем удаление субдомена
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_UPDATED,
        level: ActivityLevel.INFO,
        message: `Удалён субдомен "${oldSlug}" системы бронирования "${bookingSystem.name}"`,
        userId,
        metadata: {
          bookingSystemId: id,
          removedSlug: oldSlug,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления субдомена:", error);
      });

    return this.bookingSystemRepository.findOne({
      where: { id },
      relations: ["bot"],
    });
  }

  /**
   * Обновить настройки системы бронирования
   * Обрабатывает как визуальные настройки (title, logoUrl и т.д.), так и технические настройки бронирования
   */
  async updateSettings(
    id: string,
    settingsDto: UpdateBookingSystemSettingsDto,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(id, userId);

    // Извлекаем вложенные настройки бронирования
    const { settings, ...visualSettings } = settingsDto;

    // Применяем визуальные настройки к корню сущности
    if (visualSettings.slug !== undefined)
      bookingSystem.slug = visualSettings.slug;
    if (visualSettings.logoUrl !== undefined)
      bookingSystem.logoUrl = visualSettings.logoUrl;
    if (visualSettings.title !== undefined)
      bookingSystem.title = visualSettings.title;
    if (visualSettings.description !== undefined)
      bookingSystem.description = visualSettings.description;
    if (visualSettings.customStyles !== undefined)
      bookingSystem.customStyles = visualSettings.customStyles;
    if (visualSettings.buttonTypes !== undefined)
      bookingSystem.buttonTypes = visualSettings.buttonTypes;
    if (visualSettings.buttonSettings !== undefined)
      bookingSystem.buttonSettings = visualSettings.buttonSettings;
    if (visualSettings.browserAccessEnabled !== undefined)
      bookingSystem.browserAccessEnabled = visualSettings.browserAccessEnabled;

    // Мержим технические настройки бронирования
    if (settings) {
      bookingSystem.settings = {
        ...bookingSystem.settings,
        ...settings,
      };
    }

    const updated = await this.bookingSystemRepository.save(bookingSystem);

    // Обновляем команды бота в Telegram если система бронирования привязана к боту
    // и изменялись настройки buttonTypes или buttonSettings
    if (
      updated.botId &&
      (visualSettings.buttonTypes !== undefined ||
        visualSettings.buttonSettings !== undefined)
    ) {
      try {
        // Получаем бота отдельно, т.к. после save() relation может быть потерян
        const bot = await this.botRepository.findOne({
          where: { id: updated.botId },
        });

        if (bot) {
          const token = this.decryptToken(bot.token);
          // Получаем связанный магазин для корректного обновления всех команд
          const linkedShop = await this.getLinkedShopByBotId(updated.botId);
          const success = await this.telegramService.setBotCommands(
            token,
            bot,
            linkedShop,
            updated
          );
          if (success) {
            this.logger.log(
              `Bot commands updated after booking system settings change for ${updated.id}`
            );
          } else {
            this.logger.error(
              `Failed to update bot commands for booking system ${updated.id}`
            );
          }
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
        type: ActivityType.BOOKING_SYSTEM_SETTINGS_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлены настройки системы бронирования "${updated.name}"`,
        userId,
        metadata: {
          bookingSystemId: updated.id,
          settings: settingsDto,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления настроек:", error);
      });

    return updated;
  }

  /**
   * Удалить систему бронирования
   */
  async remove(id: string, userId: string): Promise<void> {
    const bookingSystem = await this.findOne(id, userId);
    const name = bookingSystem.name;
    const slug = bookingSystem.slug;

    // Удаляем субдомен если есть
    if (slug) {
      this.logger.log(
        `Removing subdomain before deleting booking system ${id}: ${slug}.booking`
      );
      await this.subdomainService
        .remove(slug, SubdomainType.BOOKING)
        .catch((error) => {
          this.logger.error(
            `Failed to remove subdomain for booking system ${id}: ${error.message}`
          );
        });
    }

    await this.bookingSystemRepository.remove(bookingSystem);

    // Логируем удаление
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удалена система бронирования "${name}"`,
        userId,
        metadata: {
          bookingSystemId: id,
          bookingSystemName: name,
          removedSlug: slug,
        },
      })
      .catch((error) => {
        this.logger.error(
          "Ошибка логирования удаления системы бронирования:",
          error
        );
      });
  }

  /**
   * Привязать бота к системе бронирования
   */
  async linkBot(
    bookingSystemId: string,
    botId: string,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(bookingSystemId, userId);

    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    if (bot.ownerId !== userId) {
      throw new ForbiddenException("Нет доступа к этому боту");
    }

    // Проверяем, не привязан ли бот к другой системе бронирования
    const existingBookingSystem = await this.bookingSystemRepository.findOne({
      where: { botId },
    });

    if (existingBookingSystem && existingBookingSystem.id !== bookingSystemId) {
      throw new ConflictException(
        "Этот бот уже привязан к другой системе бронирования"
      );
    }

    // Если к системе уже привязан другой бот, отвязываем его
    if (bookingSystem.botId && bookingSystem.botId !== botId) {
      this.logger.log(
        `Unlinking previous bot ${bookingSystem.botId} from booking system ${bookingSystemId}`
      );
    }

    bookingSystem.botId = botId;
    bookingSystem.bot = bot;
    const updated = await this.bookingSystemRepository.save(bookingSystem);

    // Обновляем команды бота в Telegram (добавляем /booking)
    try {
      const token = this.decryptToken(bot.token);
      // Получаем связанный магазин для корректного обновления всех команд
      const linkedShop = await this.getLinkedShopByBotId(botId);
      await this.telegramService.setBotCommands(
        token,
        bot,
        linkedShop,
        updated
      );
      this.logger.log(
        `Bot commands updated after linking booking system ${bookingSystemId}`
      );
    } catch (error) {
      this.logger.error("Ошибка обновления команд бота:", error.message);
    }

    // Логируем привязку бота
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_BOT_LINKED,
        level: ActivityLevel.SUCCESS,
        message: `Бот @${bot.username} привязан к системе бронирования "${bookingSystem.name}"`,
        userId,
        metadata: {
          bookingSystemId,
          botId,
          botUsername: bot.username,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования привязки бота:", error);
      });

    return updated;
  }

  /**
   * Отвязать бота от системы бронирования
   */
  async unlinkBot(
    bookingSystemId: string,
    userId: string
  ): Promise<BookingSystem> {
    const bookingSystem = await this.findOne(bookingSystemId, userId);

    if (!bookingSystem.botId) {
      throw new BadRequestException("К системе бронирования не привязан бот");
    }

    const previousBotId = bookingSystem.botId;
    const previousBotUsername = bookingSystem.bot?.username;
    const previousBot = bookingSystem.bot;

    bookingSystem.botId = null;
    bookingSystem.bot = undefined;
    const updated = await this.bookingSystemRepository.save(bookingSystem);

    // Обновляем команды бота в Telegram (убираем /booking)
    if (previousBot && previousBotId) {
      try {
        const token = this.decryptToken(previousBot.token);
        // Получаем связанный магазин для корректного обновления команд
        const linkedShop = await this.getLinkedShopByBotId(previousBotId);
        // bookingSystem = null, т.к. мы его отвязали
        await this.telegramService.setBotCommands(
          token,
          previousBot,
          linkedShop,
          null
        );
        this.logger.log(
          `Bot commands updated after unlinking from booking system ${bookingSystemId}`
        );
      } catch (error) {
        this.logger.error("Ошибка обновления команд бота:", error.message);
      }
    }

    // Логируем отвязку бота
    this.activityLogService
      .create({
        type: ActivityType.BOOKING_SYSTEM_BOT_UNLINKED,
        level: ActivityLevel.INFO,
        message: `Бот отвязан от системы бронирования "${bookingSystem.name}"`,
        userId,
        metadata: {
          bookingSystemId,
          previousBotId,
          previousBotUsername,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования отвязки бота:", error);
      });

    return updated;
  }

  /**
   * Получить статистику системы бронирования
   */
  async getStats(
    bookingSystemId: string,
    userId: string
  ): Promise<{
    specialistsCount: number;
    servicesCount: number;
    bookingsCount: number;
    confirmedBookingsCount: number;
    completedBookingsCount: number;
    cancelledBookingsCount: number;
    confirmationRate: number;
    completionRate: number;
    cancellationRate: number;
  }> {
    const bookingSystem = await this.findOne(bookingSystemId, userId);

    const specialistsCount = await this.specialistRepository.count({
      where: { bookingSystemId },
    });

    // Получаем услуги через специалистов
    const specialists = await this.specialistRepository.find({
      where: { bookingSystemId },
      relations: ["services"],
    });

    const serviceIds = new Set<string>();
    specialists.forEach((s) => {
      s.services?.forEach((service) => serviceIds.add(service.id));
    });
    const servicesCount = serviceIds.size;

    // Статистика бронирований
    const bookingStats = await this.bookingRepository
      .createQueryBuilder("booking")
      .leftJoin("booking.specialist", "specialist")
      .select([
        "COUNT(*) as total",
        `COUNT(CASE WHEN booking.status = '${BookingStatus.CONFIRMED}' THEN 1 END) as confirmed`,
        `COUNT(CASE WHEN booking.status = '${BookingStatus.COMPLETED}' THEN 1 END) as completed`,
        `COUNT(CASE WHEN booking.status = '${BookingStatus.CANCELLED}' THEN 1 END) as cancelled`,
      ])
      .where("specialist.bookingSystemId = :bookingSystemId", {
        bookingSystemId,
      })
      .getRawOne();

    const total = parseInt(bookingStats.total) || 0;
    const confirmed = parseInt(bookingStats.confirmed) || 0;
    const completed = parseInt(bookingStats.completed) || 0;
    const cancelled = parseInt(bookingStats.cancelled) || 0;

    return {
      specialistsCount,
      servicesCount,
      bookingsCount: total,
      confirmedBookingsCount: confirmed,
      completedBookingsCount: completed,
      cancelledBookingsCount: cancelled,
      confirmationRate: total > 0 ? (confirmed / total) * 100 : 0,
      completionRate: confirmed > 0 ? (completed / confirmed) * 100 : 0,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
    };
  }

  /**
   * Получить публичные данные системы бронирования
   */
  async getPublicData(bookingSystemId: string): Promise<{
    bookingSystem: BookingSystem;
    specialists: Specialist[];
    services: Service[];
  }> {
    const bookingSystem = await this.findOnePublic(bookingSystemId);

    const specialists = await this.specialistRepository.find({
      where: { bookingSystemId, isActive: true },
      relations: ["services"],
      order: { name: "ASC" },
    });

    // Собираем уникальные услуги
    const servicesMap = new Map<string, Service>();
    specialists.forEach((s) => {
      s.services?.forEach((service) => {
        if (service.isActive) {
          servicesMap.set(service.id, service);
        }
      });
    });

    return {
      bookingSystem,
      specialists,
      services: Array.from(servicesMap.values()),
    };
  }

  /**
   * Получить публичные данные по slug
   */
  async getPublicDataBySlug(slug: string): Promise<{
    bookingSystem: BookingSystem;
    specialists: Specialist[];
    services: Service[];
  }> {
    const bookingSystem = await this.findOneBySlug(slug);
    return this.getPublicData(bookingSystem.id);
  }
}
