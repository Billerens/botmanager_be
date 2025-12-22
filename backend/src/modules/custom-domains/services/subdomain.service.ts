import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TimewebDnsService } from "./timeweb-dns.service";
import { CaddyService } from "./caddy.service";
import { SubdomainStatus, SubdomainType, DomainTargetType } from "../enums/domain-status.enum";

/**
 * Результат регистрации субдомена
 */
export interface SubdomainRegistrationResult {
  success: boolean;
  status: SubdomainStatus;
  fullDomain: string;
  error?: string;
  /** Примерное время ожидания SSL в секундах */
  estimatedWaitTime?: number;
}

/**
 * Конфигурация для регистрации субдомена
 */
export interface RegisterSubdomainConfig {
  /** Slug сущности (например: "myshop") */
  slug: string;
  /** Тип субдомена */
  type: SubdomainType;
  /** ID целевой сущности */
  targetId: string;
}

/**
 * Сервис управления субдоменами платформы
 *
 * Отвечает за:
 * - Создание DNS записей в Timeweb
 * - Добавление маршрутов в Caddy
 * - Удаление субдоменов (DNS + маршруты)
 *
 * Flow регистрации:
 * 1. Создаём A-запись в Timeweb DNS
 * 2. Добавляем маршрут в Caddy
 * 3. Caddy автоматически получает SSL через DNS-01 challenge
 */
@Injectable()
export class SubdomainService {
  private readonly logger = new Logger(SubdomainService.name);

  /** Максимальное время ожидания SSL в секундах */
  private readonly SSL_MAX_WAIT_TIME = 120;

  /** Интервал проверки SSL в миллисекундах */
  private readonly SSL_CHECK_INTERVAL = 5000;

  /** Базовый домен */
  private readonly baseDomain: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly timewebDns: TimewebDnsService,
    private readonly caddyService: CaddyService
  ) {
    this.baseDomain =
      this.configService.get<string>("BASE_DOMAIN") || "botmanagertest.online";
  }

  /**
   * Зарегистрировать новый субдомен платформы
   *
   * @param config - Конфигурация субдомена
   * @returns Результат регистрации
   *
   * @example
   * ```typescript
   * const result = await subdomainService.register({
   *   slug: "myshop",
   *   type: SubdomainType.SHOP,
   *   targetId: "uuid-of-shop"
   * });
   * // result.fullDomain = "myshop.shops.botmanagertest.online"
   * ```
   */
  async register(
    config: RegisterSubdomainConfig
  ): Promise<SubdomainRegistrationResult> {
    const subdomain = this.timewebDns.getSubdomain(config.slug, config.type);
    const fullDomain = this.timewebDns.getFullDomain(config.slug, config.type);

    this.logger.log(`Registering subdomain: ${fullDomain}`);

    try {
      // Шаг 1: Создаём DNS запись
      const dnsRecordId = await this.timewebDns.createSubdomainRecord(subdomain);

      if (!dnsRecordId) {
        this.logger.error(`Failed to create DNS record for ${fullDomain}`);
        return {
          success: false,
          status: SubdomainStatus.DNS_ERROR,
          fullDomain,
          error: "Не удалось создать DNS запись. Попробуйте позже.",
        };
      }

      this.logger.log(`DNS record created for ${fullDomain}, adding Caddy route...`);

      // Шаг 2: Добавляем маршрут в Caddy
      const routeAdded = await this.caddyService.addRoute({
        domain: fullDomain,
        targetType: this.mapSubdomainTypeToDomainTarget(config.type),
        targetId: config.targetId,
      });

      if (!routeAdded) {
        this.logger.error(`Failed to add Caddy route for ${fullDomain}`);
        // Откатываем DNS запись
        await this.timewebDns.deleteSubdomainRecord(subdomain);
        return {
          success: false,
          status: SubdomainStatus.SSL_ERROR,
          fullDomain,
          error: "Не удалось настроить маршрутизацию. Попробуйте позже.",
        };
      }

      this.logger.log(`Subdomain ${fullDomain} registered successfully`);

      return {
        success: true,
        status: SubdomainStatus.SSL_ISSUING,
        fullDomain,
        estimatedWaitTime: this.SSL_MAX_WAIT_TIME,
      };
    } catch (error) {
      this.logger.error(
        `Failed to register subdomain ${fullDomain}: ${error.message}`
      );
      return {
        success: false,
        status: SubdomainStatus.DNS_ERROR,
        fullDomain,
        error: `Ошибка регистрации: ${error.message}`,
      };
    }
  }

  /**
   * Удалить субдомен платформы
   *
   * Удаляет маршрут из Caddy и DNS запись из Timeweb
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns true если удалён успешно
   */
  async remove(slug: string, type: SubdomainType): Promise<boolean> {
    const subdomain = this.timewebDns.getSubdomain(slug, type);
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    this.logger.log(`Removing subdomain: ${fullDomain}`);

    let success = true;

    // Шаг 1: Удаляем маршрут из Caddy
    try {
      const routeRemoved = await this.caddyService.removeRoute(fullDomain);
      if (!routeRemoved) {
        this.logger.warn(`Failed to remove Caddy route for ${fullDomain}`);
        success = false;
      }
    } catch (error) {
      this.logger.error(
        `Error removing Caddy route for ${fullDomain}: ${error.message}`
      );
      success = false;
    }

    // Шаг 2: Удаляем DNS запись из Timeweb
    try {
      const dnsDeleted = await this.timewebDns.deleteSubdomainRecord(subdomain);
      if (!dnsDeleted) {
        this.logger.warn(`Failed to delete DNS record for ${fullDomain}`);
        success = false;
      }
    } catch (error) {
      this.logger.error(
        `Error deleting DNS record for ${fullDomain}: ${error.message}`
      );
      success = false;
    }

    if (success) {
      this.logger.log(`Subdomain ${fullDomain} removed successfully`);
    } else {
      this.logger.warn(
        `Subdomain ${fullDomain} removal completed with warnings`
      );
    }

    return success;
  }

  /**
   * Проверить статус субдомена
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns Текущий статус субдомена
   */
  async checkStatus(slug: string, type: SubdomainType): Promise<SubdomainStatus> {
    const subdomain = this.timewebDns.getSubdomain(slug, type);
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    // Проверяем DNS
    const dnsExists = await this.timewebDns.recordExists(subdomain);
    if (!dnsExists) {
      return SubdomainStatus.DNS_ERROR;
    }

    // Проверяем маршрут в Caddy
    const routeExists = await this.caddyService.routeExists(fullDomain);
    if (!routeExists) {
      return SubdomainStatus.SSL_ISSUING;
    }

    // Проверяем SSL (простая проверка через HTTPS запрос)
    const sslReady = await this.checkSslReady(fullDomain);
    if (!sslReady) {
      return SubdomainStatus.SSL_ISSUING;
    }

    return SubdomainStatus.ACTIVE;
  }

  /**
   * Дождаться активации субдомена (SSL готов)
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @param timeoutMs - Таймаут в миллисекундах (по умолчанию 120 сек)
   * @returns true если субдомен активен
   */
  async waitForActivation(
    slug: string,
    type: SubdomainType,
    timeoutMs: number = this.SSL_MAX_WAIT_TIME * 1000
  ): Promise<boolean> {
    const fullDomain = this.timewebDns.getFullDomain(slug, type);
    const startTime = Date.now();

    this.logger.log(`Waiting for subdomain activation: ${fullDomain}`);

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkStatus(slug, type);

      if (status === SubdomainStatus.ACTIVE) {
        this.logger.log(`Subdomain ${fullDomain} is now active`);
        return true;
      }

      if (status === SubdomainStatus.DNS_ERROR) {
        this.logger.error(`DNS error for ${fullDomain}, aborting wait`);
        return false;
      }

      await this.delay(this.SSL_CHECK_INTERVAL);
    }

    this.logger.warn(
      `Timeout waiting for subdomain ${fullDomain} activation`
    );
    return false;
  }

  /**
   * Переименовать субдомен (изменение slug)
   *
   * @param oldSlug - Старый slug
   * @param newSlug - Новый slug
   * @param type - Тип субдомена
   * @param targetId - ID целевой сущности
   * @returns Результат переименования
   */
  async rename(
    oldSlug: string,
    newSlug: string,
    type: SubdomainType,
    targetId: string
  ): Promise<SubdomainRegistrationResult> {
    // Удаляем старый субдомен
    await this.remove(oldSlug, type);

    // Создаём новый
    return this.register({
      slug: newSlug,
      type,
      targetId,
    });
  }

  /**
   * Получить полный домен для субдомена
   */
  getFullDomain(slug: string, type: SubdomainType): string {
    return this.timewebDns.getFullDomain(slug, type);
  }

  /**
   * Проверка доступности SSL
   */
  private async checkSslReady(domain: string): Promise<boolean> {
    const https = await import("https");
    const axios = (await import("axios")).default;

    try {
      await axios.get(`https://${domain}`, {
        timeout: 5000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: true, // Проверяем валидность SSL
        }),
        validateStatus: () => true, // Любой статус OK
      });
      return true;
    } catch (error) {
      // SSL ещё не готов или ошибка сертификата
      return false;
    }
  }

  /**
   * Преобразование типа субдомена в тип цели для Caddy
   */
  private mapSubdomainTypeToDomainTarget(type: SubdomainType): DomainTargetType {
    switch (type) {
      case SubdomainType.SHOP:
        return DomainTargetType.SHOP;
      case SubdomainType.BOOKING:
        return DomainTargetType.BOOKING;
      case SubdomainType.PAGE:
        return DomainTargetType.CUSTOM_PAGE;
      default:
        return DomainTargetType.SHOP;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

