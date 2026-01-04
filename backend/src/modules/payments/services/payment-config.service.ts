import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PaymentConfig,
  PaymentEntityType,
  PaymentModuleSettings,
  PaymentMethodType,
} from "../../../database/entities/payment-config.entity";
import { Shop } from "../../../database/entities/shop.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { Bot } from "../../../database/entities/bot.entity";
import {
  encryptProviderConfig,
  decryptProviderConfig,
  maskProviderConfig,
  mergeProviderConfigs,
} from "../utils/encryption.util";

/**
 * DTO для обновления настроек платежей
 */
export interface UpdatePaymentConfigDto {
  enabled?: boolean;
  testMode?: boolean;
  settings?: Partial<PaymentModuleSettings>;
  providers?: string[];
  providerSettings?: Record<string, any>;
}

/**
 * Сервис для управления настройками платежей
 *
 * Обеспечивает:
 * - CRUD операции для PaymentConfig
 * - Шифрование/дешифрование секретных данных
 * - Валидацию прав доступа
 * - Получение настроек для разных типов сущностей
 */
@Injectable()
export class PaymentConfigService {
  private readonly logger = new Logger(PaymentConfigService.name);

  constructor(
    @InjectRepository(PaymentConfig)
    private readonly configRepository: Repository<PaymentConfig>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>
  ) {}

  /**
   * Получение настроек платежей для сущности
   */
  async getConfig(
    entityType: PaymentEntityType,
    entityId: string,
    userId?: string
  ): Promise<PaymentConfig> {
    // Проверяем существование сущности и права доступа
    const ownerId = await this.validateEntityAndGetOwner(
      entityType,
      entityId,
      userId
    );

    // Ищем существующую конфигурацию
    let config = await this.configRepository.findOne({
      where: { entityType, entityId },
    });

    // Если нет конфигурации, создаём дефолтную
    if (!config) {
      config = this.createDefaultConfig(entityType, entityId, ownerId);
    }

    return config;
  }

  /**
   * Получение настроек платежей для фронтенда (с маскированными секретами)
   */
  async getConfigForFrontend(
    entityType: PaymentEntityType,
    entityId: string,
    userId?: string
  ): Promise<PaymentConfig> {
    const config = await this.getConfig(entityType, entityId, userId);
    return this.maskConfigSecrets(config);
  }

  /**
   * Получение настроек платежей для внутреннего использования (с расшифрованными секретами)
   */
  async getConfigInternal(
    entityType: PaymentEntityType,
    entityId: string
  ): Promise<PaymentConfig> {
    const config = await this.configRepository.findOne({
      where: { entityType, entityId },
    });

    if (!config) {
      const ownerId = await this.getEntityOwnerId(entityType, entityId);
      return this.createDefaultConfig(entityType, entityId, ownerId);
    }

    return this.decryptConfigSecrets(config);
  }

  /**
   * Сохранение настроек платежей
   */
  async saveConfig(
    entityType: PaymentEntityType,
    entityId: string,
    dto: UpdatePaymentConfigDto,
    userId?: string
  ): Promise<PaymentConfig> {
    this.logger.log(
      `Saving payment config for ${entityType}:${entityId}`
    );

    // Проверяем права доступа
    const ownerId = await this.validateEntityAndGetOwner(
      entityType,
      entityId,
      userId
    );

    // Получаем существующую конфигурацию
    let config = await this.configRepository.findOne({
      where: { entityType, entityId },
    });

    const isNew = !config;

    if (isNew) {
      config = this.configRepository.create({
        entityType,
        entityId,
        ownerId,
      });
    }

    // Обновляем базовые поля
    if (dto.enabled !== undefined) {
      config.enabled = dto.enabled;
    }

    if (dto.testMode !== undefined) {
      config.testMode = dto.testMode;
    }

    // Обновляем настройки модуля
    if (dto.settings) {
      config.settings = {
        ...PaymentConfig.getDefaultSettings(),
        ...config.settings,
        ...dto.settings,
      };
    }

    // Обновляем список провайдеров
    if (dto.providers !== undefined) {
      config.providers = dto.providers;
    }

    // Обновляем настройки провайдеров
    if (dto.providerSettings) {
      const existingProviderSettings = config.providerSettings || {};

      for (const [provider, newSettings] of Object.entries(
        dto.providerSettings
      )) {
        const existingSettings = existingProviderSettings[provider] || {};

        // Мёрджим настройки (маскированные поля заменяются на существующие)
        const mergedSettings = mergeProviderConfigs(
          provider,
          existingSettings,
          newSettings
        );

        // Шифруем секретные поля
        config.providerSettings[provider] = encryptProviderConfig(
          provider,
          mergedSettings
        );
      }
    }

    // Сохраняем
    const savedConfig = await this.configRepository.save(config);

    this.logger.log(
      `Payment config ${isNew ? "created" : "updated"} for ${entityType}:${entityId}`
    );

    return this.maskConfigSecrets(savedConfig);
  }

  /**
   * Удаление настроек платежей
   */
  async deleteConfig(
    entityType: PaymentEntityType,
    entityId: string,
    userId?: string
  ): Promise<void> {
    // Проверяем права доступа
    await this.validateEntityAndGetOwner(entityType, entityId, userId);

    await this.configRepository.delete({ entityType, entityId });

    this.logger.log(`Payment config deleted for ${entityType}:${entityId}`);
  }

  /**
   * Проверка, включены ли платежи для сущности
   */
  async isPaymentEnabled(
    entityType: PaymentEntityType,
    entityId: string
  ): Promise<boolean> {
    const config = await this.configRepository.findOne({
      where: { entityType, entityId },
      select: ["enabled", "providers"],
    });

    return config?.enabled === true && config?.providers?.length > 0;
  }

  /**
   * Получение активных провайдеров для сущности
   */
  async getEnabledProviders(
    entityType: PaymentEntityType,
    entityId: string
  ): Promise<string[]> {
    const config = await this.configRepository.findOne({
      where: { entityType, entityId },
      select: ["enabled", "providers"],
    });

    if (!config?.enabled) {
      return [];
    }

    return config.providers || [];
  }

  /**
   * Получение настроек конкретного провайдера (расшифрованные)
   */
  async getProviderConfig<T = any>(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string
  ): Promise<T | null> {
    const config = await this.getConfigInternal(entityType, entityId);

    if (!config.providers.includes(provider)) {
      return null;
    }

    const providerSettings = config.providerSettings[provider];
    if (!providerSettings) {
      return null;
    }

    return decryptProviderConfig(provider, providerSettings) as T;
  }

  // ============================================
  // Приватные методы
  // ============================================

  /**
   * Валидация сущности и получение ownerId
   */
  private async validateEntityAndGetOwner(
    entityType: PaymentEntityType,
    entityId: string,
    userId?: string
  ): Promise<string> {
    const ownerId = await this.getEntityOwnerId(entityType, entityId);

    // Если userId указан, проверяем права доступа
    if (userId && ownerId !== userId) {
      throw new ForbiddenException(
        `У вас нет доступа к настройкам платежей для ${entityType}:${entityId}`
      );
    }

    return ownerId;
  }

  /**
   * Получение ownerId сущности
   */
  private async getEntityOwnerId(
    entityType: PaymentEntityType,
    entityId: string
  ): Promise<string> {
    let entity: { ownerId: string } | null = null;

    switch (entityType) {
      case PaymentEntityType.SHOP:
        entity = await this.shopRepository.findOne({
          where: { id: entityId },
          select: ["ownerId"],
        });
        break;

      case PaymentEntityType.BOOKING_SYSTEM:
        entity = await this.bookingSystemRepository.findOne({
          where: { id: entityId },
          select: ["ownerId"],
        });
        break;

      case PaymentEntityType.CUSTOM_PAGE:
        entity = await this.customPageRepository.findOne({
          where: { id: entityId },
          select: ["ownerId"],
        });
        break;

      case PaymentEntityType.BOT:
        entity = await this.botRepository.findOne({
          where: { id: entityId },
          select: ["ownerId"],
        });
        break;
    }

    if (!entity) {
      throw new NotFoundException(
        `${entityType} с ID ${entityId} не найден`
      );
    }

    return entity.ownerId;
  }

  /**
   * Создание дефолтной конфигурации
   */
  private createDefaultConfig(
    entityType: PaymentEntityType,
    entityId: string,
    ownerId: string
  ): PaymentConfig {
    const config = new PaymentConfig();
    config.entityType = entityType;
    config.entityId = entityId;
    config.ownerId = ownerId;
    config.enabled = false;
    config.testMode = true;
    config.settings = PaymentConfig.getDefaultSettings();
    config.providers = [];
    config.providerSettings = {};
    return config;
  }

  /**
   * Маскирование секретных данных для фронтенда
   */
  private maskConfigSecrets(config: PaymentConfig): PaymentConfig {
    const maskedConfig = { ...config };
    const maskedProviderSettings: Record<string, any> = {};

    for (const [provider, settings] of Object.entries(
      config.providerSettings || {}
    )) {
      maskedProviderSettings[provider] = maskProviderConfig(provider, settings);
    }

    maskedConfig.providerSettings = maskedProviderSettings;
    return maskedConfig;
  }

  /**
   * Расшифровка секретных данных для внутреннего использования
   */
  private decryptConfigSecrets(config: PaymentConfig): PaymentConfig {
    const decryptedConfig = { ...config };
    const decryptedProviderSettings: Record<string, any> = {};

    for (const [provider, settings] of Object.entries(
      config.providerSettings || {}
    )) {
      decryptedProviderSettings[provider] = decryptProviderConfig(
        provider,
        settings
      );
    }

    decryptedConfig.providerSettings = decryptedProviderSettings;
    return decryptedConfig;
  }
}

