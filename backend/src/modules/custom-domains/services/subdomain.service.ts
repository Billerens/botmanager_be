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
  /** ID поддомена в Timeweb (если создан) */
  subdomainId?: number;
  /** ID DNS записи в Timeweb (если создана) */
  dnsRecordId?: number;
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
 * - Создание поддоменов в Timeweb
 * - Создание A-записей в Timeweb DNS
 * - Удаление поддоменов и DNS записей при удалении субдомена
 *
 * Архитектура:
 * - Backend создаёт поддомены и DNS записи через Timeweb API
 * - Timeweb Load Balancer автоматически выдаёт SSL сертификаты
 * - Caddy роутит трафик по wildcard правилам (настроены статически)
 *
 * Flow регистрации (2-шаговый процесс):
 * 1. Backend создаёт поддомен в Timeweb: POST /domains/{baseDomain}/subdomains/{fqdn}
 * 2. Backend создаёт A-запись: POST /domains/{fqdn}/dns-records
 * 3. Timeweb LB обнаруживает новый домен и выдаёт SSL
 * 4. Caddy роутит запросы по wildcard правилам
 *
 * Flow удаления (2-шаговый процесс):
 * 1. Удалить все DNS записи поддомена
 * 2. Удалить сам поддомен
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
   * Выполняет 2-шаговый процесс:
   * 1. Создание поддомена в Timeweb
   * 2. Создание A-записи для поддомена
   *
   * SSL сертификат выдаётся автоматически Timeweb Load Balancer.
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
    const fullDomain = this.timewebDns.getFullDomain(config.slug, config.type);

    this.logger.log(
      `Registering subdomain: ${fullDomain} for ${config.type} ${config.targetId}`
    );

    try {
      // Используем новый 2-шаговый метод регистрации
      const result = await this.timewebDns.registerSubdomain(
        config.slug,
        config.type
      );

      if (!result.success) {
        this.logger.error(`Failed to register subdomain ${fullDomain}: ${result.error}`);
        return {
          success: false,
          status: SubdomainStatus.ERROR,
          fullDomain,
          error: result.error || "Не удалось зарегистрировать субдомен. Попробуйте позже.",
        };
      }

      this.logger.log(
        `Subdomain registered: ${fullDomain} ` +
          `(subdomain_id: ${result.subdomain?.id}, dns_record_id: ${result.dnsRecordId}). ` +
          `Waiting for DNS propagation and SSL certificate...`
      );

      return {
        success: true,
        status: SubdomainStatus.ACTIVATING,
        fullDomain,
        estimatedWaitTime: this.ESTIMATED_ACTIVATION_TIME,
        subdomainId: result.subdomain?.id,
        dnsRecordId: result.dnsRecordId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to register subdomain ${fullDomain}: ${error.message}`
      );
      return {
        success: false,
        status: SubdomainStatus.ERROR,
        fullDomain,
        error: `Ошибка регистрации: ${error.message}`,
      };
    }
  }

  /**
   * Удалить субдомен платформы
   *
   * Выполняет 2-шаговый процесс:
   * 1. Удаление всех DNS записей поддомена
   * 2. Удаление самого поддомена
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns true если удалён успешно
   */
  async remove(slug: string, type: SubdomainType): Promise<boolean> {
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    this.logger.log(`Removing subdomain: ${fullDomain}`);

    try {
      // Используем новый метод полного удаления
      const deleted = await this.timewebDns.unregisterSubdomain(slug, type);

      if (deleted) {
        this.logger.log(`Subdomain ${fullDomain} removed successfully`);
      } else {
        this.logger.warn(`Failed to fully remove subdomain ${fullDomain}`);
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
   * Проверяет существование поддомена в Timeweb и доступность по HTTPS.
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns Текущий статус субдомена
   */
  async checkStatus(
    slug: string,
    type: SubdomainType
  ): Promise<SubdomainStatus> {
    const fullDomain = this.timewebDns.getFullDomain(slug, type);

    // Проверяем существование поддомена в Timeweb
    const subdomainExists = await this.timewebDns.subdomainExists(fullDomain);
    if (!subdomainExists) {
      return SubdomainStatus.ERROR;
    }

    // Проверяем доступность по HTTPS (DNS распространился + Timeweb выдал SSL)
    const isAccessible = await this.checkHttpsAccessible(fullDomain);
    if (!isAccessible) {
      // Поддомен есть, но домен ещё недоступен - ждём propagation и SSL от Timeweb
      return SubdomainStatus.ACTIVATING;
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

      if (status === SubdomainStatus.ERROR) {
        this.logger.error(`Error for ${fullDomain}, aborting wait`);
        return false;
      }

      await this.delay(checkInterval);
    }

    this.logger.warn(`Timeout waiting for subdomain ${fullDomain} activation`);
    return false;
  }

  /**
   * Проверить существование субдомена в Timeweb
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns true если субдомен существует
   */
  async exists(slug: string, type: SubdomainType): Promise<boolean> {
    const fullDomain = this.timewebDns.getFullDomain(slug, type);
    return await this.timewebDns.subdomainExists(fullDomain);
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

      await axios.get(`https://${domain}/health`, {
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: true, // Проверяем валидность SSL
        }),
        validateStatus: () => true, // Любой HTTP статус OK
      });

      // Если получили ответ без SSL ошибки - субдомен активен
      return true;
    } catch {
      // SSL ещё не готов или другая ошибка
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
