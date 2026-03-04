import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemSetting } from "../../database/entities/system-setting.entity";

/** Default values for system settings */
export const SYSTEM_SETTING_DEFAULTS: Record<
  string,
  { value: any; description: string }
> = {
  allowed_users: {
    value: [],
    description:
      "Список разрешённых Telegram ID для регистрации/входа. Пустой массив = разрешены все.",
  },
  openrouter_default_model: {
    value: "meta-llama/llama-3.3-70b-instruct",
    description: "Модель OpenRouter по умолчанию",
  },
  openrouter_allowed_models: {
    value: [],
    description:
      "Список разрешённых моделей OpenRouter. Пустой массив = все модели разрешены.",
  },
  max_active_groups_per_bot: {
    value: 1000,
    description: "Максимальное количество активных групповых сессий на одного бота",
  },
  max_groups_per_user_per_bot: {
    value: 1,
    description: "Максимальное количество групп на одного пользователя в боте",
  },
};

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);

  /** In-memory cache */
  private cache = new Map<string, any>();

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepository: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
    await this.loadCache();
  }

  /**
   * Seed default settings that do not yet exist in DB
   */
  private async seedDefaults(): Promise<void> {
    for (const [key, { value, description }] of Object.entries(
      SYSTEM_SETTING_DEFAULTS,
    )) {
      const existing = await this.settingRepository.findOne({ where: { key } });
      if (!existing) {
        await this.settingRepository.save(
          this.settingRepository.create({ key, value, description }),
        );
        this.logger.log(`Seeded default setting: ${key}`);
      }
    }
  }

  /**
   * Load all settings into in-memory cache
   */
  private async loadCache(): Promise<void> {
    const all = await this.settingRepository.find();
    this.cache.clear();
    for (const s of all) {
      this.cache.set(s.key, s.value);
    }
    this.logger.log(`Loaded ${all.length} system settings into cache`);
  }

  /**
   * Get a setting value by key. Uses in-memory cache.
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const setting = await this.settingRepository.findOne({ where: { key } });
    if (setting) {
      this.cache.set(key, setting.value);
      return setting.value as T;
    }

    // Return default if available
    const def = SYSTEM_SETTING_DEFAULTS[key];
    return def ? (def.value as T) : undefined;
  }

  /**
   * Set a setting value by key. Updates cache.
   */
  async set(key: string, value: any): Promise<SystemSetting> {
    let setting = await this.settingRepository.findOne({ where: { key } });

    if (setting) {
      setting.value = value;
    } else {
      setting = this.settingRepository.create({
        key,
        value,
        description: SYSTEM_SETTING_DEFAULTS[key]?.description || null,
      });
    }

    const saved = await this.settingRepository.save(setting);
    this.cache.set(key, value);
    this.logger.log(`Updated setting: ${key}`);
    return saved;
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<SystemSetting[]> {
    return this.settingRepository.find({ order: { key: "ASC" } });
  }

  /**
   * Invalidate cache (force reload on next access)
   */
  async invalidateCache(): Promise<void> {
    await this.loadCache();
  }
}
