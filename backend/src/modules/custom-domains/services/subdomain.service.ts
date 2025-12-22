import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TimewebDnsService } from "./timeweb-dns.service";
import { SubdomainStatus, SubdomainType } from "../enums/domain-status.enum";

/**
 * Результат регистрации субдомена
 */
export interface SubdomainRegistrationResult {
  success: boolean;
  status: SubdomainStatus;
  fullDomain: string;
  error?: string;
  /** Примерное время ожидания активации (DNS + SSL) в секундах */
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
  /** ID целевой сущности (для логирования) */
  targetId: string;
}

/**
 * Сервис управления субдоменами платформы
 *
 * Отвечает за:
 * - Создание A-записей в Timeweb DNS
 * - Удаление A-записей при удалении субдомена
 *
 * Архитектура:
 * - Backend создаёт/удаляет DNS записи через Timeweb API
 * - Timeweb Load Balancer автоматически выдаёт SSL сертификаты
 * - Caddy роутит трафик по wildcard правилам (настроены статически)
 *
 * Flow регистрации:
 * 1. Backend создаёт A-запись в Timeweb DNS → IP сервера
 * 2. Timeweb LB обнаруживает новый домен и выдаёт SSL
 * 3. Caddy роутит запросы по wildcard правилам
 */
@Injectable()
export class SubdomainService {
  private readonly logger = new Logger(SubdomainService.name);

  /** Примерное время активации субдомена (DNS propagation + SSL) в секундах */
  private readonly ESTIMATED_ACTIVATION_TIME = 300; // 5 минут

  /** Базовый домен */
  private readonly baseDomain: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly timewebDns: TimewebDnsService
  ) {
    this.baseDomain =
      this.configService.get<string>("BASE_DOMAIN") || "botmanagertest.online";
  }

  /**
   * Зарегистрировать новый субдомен платформы
   *
   * Создаёт A-запись в Timeweb DNS. SSL сертификат выдаётся
   * автоматически Timeweb Load Balancer.
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

    this.logger.log(
      `Registering subdomain: ${fullDomain} for ${config.type} ${config.targetId}`
    );

    try {
      // Создаём A-запись в Timeweb DNS
      const dnsRecordId =
        await this.timewebDns.createSubdomainRecord(subdomain);

      if (!dnsRecordId) {
        this.logger.error(`Failed to create DNS record for ${fullDomain}`);
        return {
          success: false,
          status: SubdomainStatus.DNS_ERROR,
          fullDomain,
          error: "Не удалось создать DNS запись. Попробуйте позже.",
        };
      }

      this.logger.log(
        `DNS record created for ${fullDomain} (ID: ${dnsRecordId}). ` +
          `Waiting for DNS propagation and SSL certificate...`
      );

      return {
        success: true,
        status: SubdomainStatus.DNS_CREATING,
        fullDomain,
        estimatedWaitTime: this.ESTIMATED_ACTIVATION_TIME,
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
   * Удаляет A-запись из Timeweb DNS.
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns true если удалён успешно
   */
  async remove(slug: string, type: SubdomainType): Promise<boolean> {
    const subdomain = this.timewebDns.getSubdomain(slug, type);
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    this.logger.log(`Removing subdomain: ${fullDomain}`);

    try {
      const deleted = await this.timewebDns.deleteSubdomainRecord(subdomain);

      if (deleted) {
        this.logger.log(`Subdomain ${fullDomain} removed successfully`);
      } else {
        this.logger.warn(`Failed to delete DNS record for ${fullDomain}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Error removing subdomain ${fullDomain}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Проверить статус субдомена
   *
   * Проверяет существование DNS записи и доступность по HTTPS.
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns Текущий статус субдомена
   */
  async checkStatus(
    slug: string,
    type: SubdomainType
  ): Promise<SubdomainStatus> {
    const subdomain = this.timewebDns.getSubdomain(slug, type);
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    // Проверяем существование DNS записи
    const dnsExists = await this.timewebDns.recordExists(subdomain);
    if (!dnsExists) {
      return SubdomainStatus.DNS_ERROR;
    }

    // Проверяем доступность по HTTPS (значит SSL готов)
    const isAccessible = await this.checkHttpsAccessible(fullDomain);
    if (!isAccessible) {
      // DNS есть, но HTTPS недоступен - ждём SSL от Timeweb
      return SubdomainStatus.SSL_ISSUING;
    }

    return SubdomainStatus.ACTIVE;
  }

  /**
   * Дождаться активации субдомена
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @param timeoutMs - Таймаут в миллисекундах (по умолчанию 5 минут)
   * @returns true если субдомен активен
   */
  async waitForActivation(
    slug: string,
    type: SubdomainType,
    timeoutMs: number = this.ESTIMATED_ACTIVATION_TIME * 1000
  ): Promise<boolean> {
    const fullDomain = this.timewebDns.getFullDomain(slug, type);
    const startTime = Date.now();
    const checkInterval = 10000; // 10 секунд

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

      await this.delay(checkInterval);
    }

    this.logger.warn(`Timeout waiting for subdomain ${fullDomain} activation`);
    return false;
  }

  /**
   * Получить полный домен для субдомена
   */
  getFullDomain(slug: string, type: SubdomainType): string {
    return this.timewebDns.getFullDomain(slug, type);
  }

  /**
   * Проверка доступности HTTPS
   */
  private async checkHttpsAccessible(domain: string): Promise<boolean> {
    try {
      const https = await import("https");
      const axios = (await import("axios")).default;

      const response = await axios.get(`https://${domain}/health`, {
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: true, // Проверяем валидность SSL
        }),
        validateStatus: () => true, // Любой HTTP статус OK
      });

      // Если получили ответ без SSL ошибки - субдомен активен
      return true;
    } catch (error) {
      // SSL ещё не готов или другая ошибка
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
