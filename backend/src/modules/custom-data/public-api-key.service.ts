import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PublicApiKey,
  generateApiKey,
} from "../../database/entities/public-api-key.entity";
import { CustomDataOwnerType } from "../../database/entities/custom-collection-schema.entity";

export interface CreateApiKeyDto {
  name: string;
  description?: string;
  isTestMode?: boolean;
  allowedDomains?: string[];
  allowedIps?: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

export interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  allowedDomains?: string[];
  allowedIps?: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

export interface ApiKeyContext {
  apiKey: PublicApiKey;
  ownerId: string;
  ownerType: CustomDataOwnerType;
}

@Injectable()
export class PublicApiKeyService {
  constructor(
    @InjectRepository(PublicApiKey)
    private readonly apiKeyRepository: Repository<PublicApiKey>,
  ) {}

  /**
   * Создать новый API ключ для владельца
   */
  async createApiKey(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    dto: CreateApiKeyDto,
  ): Promise<PublicApiKey> {
    // Генерируем уникальный ключ
    let key: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      key = generateApiKey(dto.isTestMode);
      const exists = await this.apiKeyRepository.findOne({ where: { key } });
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new ConflictException("Не удалось сгенерировать уникальный ключ");
    }

    const apiKey = this.apiKeyRepository.create({
      key,
      name: dto.name,
      description: dto.description,
      ownerId,
      ownerType,
      isTestMode: dto.isTestMode || false,
      allowedDomains: dto.allowedDomains || [],
      allowedIps: dto.allowedIps || [],
      rateLimit: dto.rateLimit || 60,
      expiresAt: dto.expiresAt,
    });

    return this.apiKeyRepository.save(apiKey);
  }

  /**
   * Получить список API ключей владельца
   */
  async getApiKeys(
    ownerId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<PublicApiKey[]> {
    return this.apiKeyRepository.find({
      where: { ownerId, ownerType },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Получить API ключ по ID
   */
  async getApiKeyById(
    id: string,
    ownerId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<PublicApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, ownerId, ownerType },
    });

    if (!apiKey) {
      throw new NotFoundException("API ключ не найден");
    }

    return apiKey;
  }

  /**
   * Обновить API ключ
   */
  async updateApiKey(
    id: string,
    ownerId: string,
    ownerType: CustomDataOwnerType,
    dto: UpdateApiKeyDto,
  ): Promise<PublicApiKey> {
    const apiKey = await this.getApiKeyById(id, ownerId, ownerType);

    Object.assign(apiKey, dto);

    return this.apiKeyRepository.save(apiKey);
  }

  /**
   * Удалить API ключ
   */
  async deleteApiKey(
    id: string,
    ownerId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<void> {
    const apiKey = await this.getApiKeyById(id, ownerId, ownerType);
    await this.apiKeyRepository.remove(apiKey);
  }

  /**
   * Регенерировать API ключ (создать новый, сохранив настройки)
   */
  async regenerateApiKey(
    id: string,
    ownerId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<PublicApiKey> {
    const apiKey = await this.getApiKeyById(id, ownerId, ownerType);

    // Генерируем новый ключ
    let newKey: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      newKey = generateApiKey(apiKey.isTestMode);
      const exists = await this.apiKeyRepository.findOne({
        where: { key: newKey },
      });
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new ConflictException("Не удалось сгенерировать уникальный ключ");
    }

    apiKey.key = newKey;
    apiKey.usageCount = 0;
    apiKey.lastUsedAt = null;

    return this.apiKeyRepository.save(apiKey);
  }

  /**
   * Валидировать API ключ и получить контекст
   * Используется в guard'е для аутентификации
   */
  async validateApiKey(
    key: string,
    origin?: string,
    ip?: string,
  ): Promise<ApiKeyContext> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { key, isActive: true },
    });

    if (!apiKey) {
      throw new ForbiddenException("Недействительный API ключ");
    }

    // Проверяем срок действия
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      throw new ForbiddenException("API ключ истёк");
    }

    // Проверяем разрешённые домены
    if (apiKey.allowedDomains.length > 0 && origin) {
      const originHost = this.extractHost(origin);
      const isAllowed = apiKey.allowedDomains.some((domain) =>
        this.matchDomain(originHost, domain),
      );
      if (!isAllowed) {
        throw new ForbiddenException("Домен не разрешён для этого API ключа");
      }
    }

    // Проверяем разрешённые IP
    if (apiKey.allowedIps.length > 0 && ip) {
      const isAllowed = apiKey.allowedIps.includes(ip);
      if (!isAllowed) {
        throw new ForbiddenException("IP адрес не разрешён для этого API ключа");
      }
    }

    // Обновляем статистику использования (асинхронно, не блокируя запрос)
    this.updateUsageStats(apiKey.id).catch(() => {});

    return {
      apiKey,
      ownerId: apiKey.ownerId,
      ownerType: apiKey.ownerType,
    };
  }

  /**
   * Обновить статистику использования ключа
   */
  private async updateUsageStats(apiKeyId: string): Promise<void> {
    await this.apiKeyRepository.update(apiKeyId, {
      lastUsedAt: new Date(),
      usageCount: () => "usage_count + 1",
    });
  }

  /**
   * Извлечь хост из URL origin
   */
  private extractHost(origin: string): string {
    try {
      const url = new URL(origin);
      return url.host;
    } catch {
      return origin;
    }
  }

  /**
   * Проверить соответствие домена шаблону
   * Поддерживает wildcard: *.example.com
   */
  private matchDomain(host: string, pattern: string): boolean {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // .example.com
      return host.endsWith(suffix) || host === pattern.slice(2);
    }
    return host === pattern;
  }
}
