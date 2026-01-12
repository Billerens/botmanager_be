import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

// ============================================================================
// ИНТЕРФЕЙСЫ TIMEWEB API
// ============================================================================

/**
 * Поддомен Timeweb
 */
export interface TimewebSubdomain {
  id: number;
  fqdn: string;
  linked_ip: string | null;
}

/**
 * DNS запись Timeweb (v1 API)
 */
export interface TimewebDnsRecord {
  id: number;
  type: string;
  ttl: number;
  fqdn?: string;
  data: {
    subdomain?: string | null;
    value: string;
    priority?: number;
  };
}

/**
 * Ответ Timeweb API на запрос записей
 */
interface TimewebDnsResponse {
  dns_records: TimewebDnsRecord[];
  meta?: {
    total: number;
  };
}

/**
 * Ответ Timeweb API на создание DNS записи
 */
interface TimewebCreateDnsResponse {
  dns_record: TimewebDnsRecord;
}

/**
 * Ответ Timeweb API на создание поддомена
 */
interface TimewebCreateSubdomainResponse {
  subdomain: TimewebSubdomain;
}

/**
 * Домен Timeweb с поддоменами
 */
interface TimewebDomain {
  id: number;
  fqdn: string;
  subdomains: TimewebSubdomain[];
}

/**
 * Ответ Timeweb API на запрос домена
 */
interface TimewebDomainResponse {
  domain: TimewebDomain;
}

/**
 * Конфигурация для создания DNS записи
 */
export interface CreateDnsRecordConfig {
  /** Тип записи */
  type: "A" | "CNAME" | "TXT" | "MX" | "AAAA" | "SRV";
  /** Значение записи (IP адрес, домен и т.д.) */
  value: string;
  /** TTL в секундах (по умолчанию 600) */
  ttl?: number;
  /** Приоритет (для MX записей) */
  priority?: number;
}

/**
 * Результат регистрации поддомена в Timeweb
 */
export interface SubdomainRegistrationResult {
  success: boolean;
  subdomain?: TimewebSubdomain;
  dnsRecordId?: number;
  error?: string;
}

@Injectable()
export class TimewebDnsService implements OnModuleInit {
  private readonly logger = new Logger(TimewebDnsService.name);
  private client: AxiosInstance;

  /** Базовый домен платформы (например: botmanagertest.online) */
  private readonly baseDomain: string;

  /** IP адрес Frontend сервера */
  private readonly frontendIp: string;

  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiToken = this.configService.get<string>("TIMEWEB_API_TOKEN");
    // Используем v1 API согласно официальной документации Timeweb Cloud
    this.apiUrl =
      this.configService.get<string>("TIMEWEB_API_URL") ||
      "https://api.timeweb.cloud/api/v1";

    this.baseDomain =
      this.configService.get<string>("BASE_DOMAIN") || "botmanagertest.online";
    this.frontendIp = this.configService.get<string>("FRONTEND_IP") || "";

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    // Добавляем interceptors для подробного логирования
    this.setupLoggingInterceptors();
  }

  /**
   * Настройка interceptors для логирования всех запросов и ответов Timeweb API
   */
  private setupLoggingInterceptors(): void {
    // Request interceptor - логируем исходящие запросы
    this.client.interceptors.request.use(
      (config) => {
        const method = config.method?.toUpperCase() || "UNKNOWN";
        const url = config.url || "";
        const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
        const params = config.params ? JSON.stringify(config.params) : "none";
        const data = config.data ? JSON.stringify(config.data) : "none";

        this.logger.log(
          `🔵 [TIMEWEB DNS API REQUEST] ${method} ${fullUrl}` +
            (params !== "none" ? ` | Query: ${params}` : "") +
            (data !== "none" ? ` | Body: ${data}` : "")
        );

        return config;
      },
      (error) => {
        this.logger.error(
          `🔴 [TIMEWEB DNS API REQUEST ERROR] ${error.message}`,
          error.stack
        );
        return Promise.reject(error);
      }
    );

    // Response interceptor - логируем успешные ответы
    this.client.interceptors.response.use(
      (response) => {
        const method = response.config.method?.toUpperCase() || "UNKNOWN";
        const url = response.config.url || "";
        const fullUrl = response.config.baseURL
          ? `${response.config.baseURL}${url}`
          : url;
        const status = response.status;
        const responseData = JSON.stringify(response.data);

        this.logger.log(
          `🟢 [TIMEWEB DNS API RESPONSE] ${method} ${fullUrl} | Status: ${status} | Response: ${responseData}`
        );

        return response;
      },
      (error) => {
        const method = error.config?.method?.toUpperCase() || "UNKNOWN";
        const url = error.config?.url || "";
        const fullUrl = error.config?.baseURL
          ? `${error.config.baseURL}${url}`
          : url;
        const status = error.response?.status || "NO_STATUS";
        const responseData = error.response?.data
          ? JSON.stringify(error.response.data)
          : "NO_RESPONSE";
        const message = error.message || "Unknown error";

        this.logger.error(
          `🔴 [TIMEWEB DNS API RESPONSE ERROR] ${method} ${fullUrl} | Status: ${status} | Message: ${message} | Response: ${responseData}`
        );

        return Promise.reject(error);
      }
    );
  }

  async onModuleInit() {
    // Проверяем доступность API при старте
    try {
      await this.getDomainInfo();
    } catch (error) {
      this.logger.warn(
        `Timeweb DNS API not available. Subdomain management will not work.`
      );
    }
  }

  // ============================================================================
  // РАБОТА С ДОМЕНОМ
  // ============================================================================

  /**
   * Получить информацию о базовом домене
   */
  async getDomainInfo(): Promise<TimewebDomain | null> {
    try {
      const response = await this.client.get<TimewebDomainResponse>(
        `/domains/${this.baseDomain}`
      );
      return response.data.domain;
    } catch (error) {
      this.logError("getDomainInfo", error);
      return null;
    }
  }

  /**
   * Получить список всех поддоменов базового домена
   */
  async getSubdomains(): Promise<TimewebSubdomain[]> {
    const domain = await this.getDomainInfo();
    return domain?.subdomains || [];
  }

  // ============================================================================
  // РАБОТА С ПОДДОМЕНАМИ
  // ============================================================================

  /**
   * Создать поддомен в Timeweb
   *
   * @param subdomainFqdn - Полный FQDN поддомена (например: "myshop.shops.botmanagertest.online")
   * @returns Созданный поддомен или null при ошибке
   */
  async createSubdomain(
    subdomainFqdn: string
  ): Promise<TimewebSubdomain | null> {
    try {
      // Проверяем, существует ли уже такой поддомен
      const existing = await this.findSubdomain(subdomainFqdn);
      if (existing) {
        return existing;
      }

      // Извлекаем относительное имя субдомена (без базового домена)
      // test.pages.botmanagertest.online → test.pages
      const relativeName = this.extractRelativeName(subdomainFqdn);

      // POST /domains/{baseDomain}/subdomains/{relative_subdomain_name}
      const requestUrl = `/domains/${this.baseDomain}/subdomains/${relativeName}`;

      const response =
        await this.client.post<TimewebCreateSubdomainResponse>(requestUrl);

      const subdomain = response.data.subdomain;

      return subdomain;
    } catch (error) {
      // 409 Conflict - поддомен уже существует
      if (error.response?.status === 409) {
        // Пытаемся получить существующий поддомен
        return await this.findSubdomain(subdomainFqdn);
      }

      this.logError(`createSubdomain(${subdomainFqdn})`, error);
      return null;
    }
  }

  /**
   * Удалить поддомен из Timeweb
   *
   * @param subdomainFqdn - Полный FQDN поддомена
   * @returns true если удалён успешно или не существовал
   */
  async deleteSubdomain(subdomainFqdn: string): Promise<boolean> {
    try {
      // Извлекаем относительное имя субдомена (без базового домена)
      const relativeName = this.extractRelativeName(subdomainFqdn);

      // DELETE /domains/{baseDomain}/subdomains/{relative_subdomain_name}
      const requestUrl = `/domains/${this.baseDomain}/subdomains/${relativeName}`;

      await this.client.delete(requestUrl);

      return true;
    } catch (error) {
      // 404 - поддомен не существует, считаем удалённым
      if (error.response?.status === 404) {
        return true;
      }

      this.logError(`deleteSubdomain(${subdomainFqdn})`, error);
      return false;
    }
  }

  /**
   * Найти поддомен по FQDN
   */
  async findSubdomain(subdomainFqdn: string): Promise<TimewebSubdomain | null> {
    try {
      const subdomains = await this.getSubdomains();
      return (
        subdomains.find(
          (s) => s.fqdn.toLowerCase() === subdomainFqdn.toLowerCase()
        ) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Проверить существование поддомена
   */
  async subdomainExists(subdomainFqdn: string): Promise<boolean> {
    const subdomain = await this.findSubdomain(subdomainFqdn);
    return subdomain !== null;
  }

  // ============================================================================
  // РАБОТА С DNS ЗАПИСЯМИ
  // ============================================================================

  /**
   * Получить DNS записи для домена/поддомена
   *
   * @param fqdn - FQDN домена или поддомена
   */
  async getDnsRecords(fqdn?: string): Promise<TimewebDnsRecord[]> {
    try {
      const targetFqdn = fqdn || this.baseDomain;
      const response = await this.client.get<TimewebDnsResponse>(
        `/domains/${targetFqdn}/dns-records`
      );
      return response.data.dns_records || [];
    } catch (error) {
      this.logError(`getDnsRecords(${fqdn || this.baseDomain})`, error);
      return [];
    }
  }

  /**
   * Создать DNS запись для домена/поддомена
   *
   * @param fqdn - FQDN домена или поддомена, для которого создаётся запись
   * @param config - Конфигурация DNS записи
   * @returns ID созданной записи или null при ошибке
   */
  async createDnsRecord(
    fqdn: string,
    config: CreateDnsRecordConfig
  ): Promise<number | null> {
    try {
      const requestUrl = `/domains/${fqdn}/dns-records`;
      const requestBody = {
        type: config.type,
        value: config.value,
        ...(config.ttl && { ttl: config.ttl }),
        ...(config.priority !== undefined && { priority: config.priority }),
      };

      const response = await this.client.post<TimewebCreateDnsResponse>(
        requestUrl,
        requestBody
      );

      const recordId = response.data.dns_record?.id;

      return recordId;
    } catch (error) {
      this.logError(`createDnsRecord(${fqdn})`, error);
      return null;
    }
  }

  /**
   * Удалить DNS запись
   *
   * @param fqdn - FQDN домена или поддомена
   * @param recordId - ID записи
   */
  async deleteDnsRecord(fqdn: string, recordId: number): Promise<boolean> {
    try {
      const requestUrl = `/domains/${fqdn}/dns-records/${recordId}`;

      await this.client.delete(requestUrl);

      return true;
    } catch (error) {
      // 404 - запись не существует
      if (error.response?.status === 404) {
        return true;
      }

      this.logError(`deleteDnsRecord(${fqdn}, ${recordId})`, error);
      return false;
    }
  }

  /**
   * Удалить все DNS записи для поддомена
   *
   * @param subdomainFqdn - FQDN поддомена
   */
  async deleteAllDnsRecords(subdomainFqdn: string): Promise<boolean> {
    try {
      const records = await this.getDnsRecords(subdomainFqdn);

      if (records.length === 0) {
        return true;
      }

      let allDeleted = true;
      for (const record of records) {
        const deleted = await this.deleteDnsRecord(subdomainFqdn, record.id);
        if (!deleted) {
          allDeleted = false;
        }
      }

      return allDeleted;
    } catch (error) {
      this.logError(`deleteAllDnsRecords(${subdomainFqdn})`, error);
      return false;
    }
  }

  // ============================================================================
  // ВЫСОКОУРОВНЕВЫЕ МЕТОДЫ РЕГИСТРАЦИИ
  // ============================================================================

  /**
   * Зарегистрировать поддомен платформы (2-шаговый процесс)
   *
   * Шаг 1: Создать поддомен в Timeweb
   * Шаг 2: Создать A-запись для поддомена
   *
   * @param slug - Slug сущности (например: "myshop")
   * @param type - Тип субдомена ("shops", "booking", "pages")
   * @returns Результат регистрации
   */
  async registerSubdomain(
    slug: string,
    type: string
  ): Promise<SubdomainRegistrationResult> {
    if (!this.frontendIp) {
      return {
        success: false,
        error: "FRONTEND_IP not configured. Cannot create subdomains.",
      };
    }

    const subdomainFqdn = this.getFullDomain(slug, type);

    // ШАГ 1: Создать поддомен
    const subdomain = await this.createSubdomain(subdomainFqdn);

    if (!subdomain) {
      return {
        success: false,
        error: `Failed to create subdomain ${subdomainFqdn}`,
      };
    }

    // ШАГ 2: Создать A-запись
    const dnsRecordId = await this.createDnsRecord(subdomainFqdn, {
      type: "A",
      value: this.frontendIp,
    });

    if (!dnsRecordId) {
      // Rollback: удаляем созданный поддомен
      await this.deleteSubdomain(subdomainFqdn);

      return {
        success: false,
        error: `Failed to create DNS A-record for ${subdomainFqdn}`,
      };
    }

    return {
      success: true,
      subdomain,
      dnsRecordId,
    };
  }

  /**
   * Удалить поддомен платформы (полное удаление)
   *
   * Шаг 1: Удалить все DNS записи поддомена
   * Шаг 2: Удалить сам поддомен
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns true если удалено успешно
   */
  async unregisterSubdomain(slug: string, type: string): Promise<boolean> {
    const subdomainFqdn = this.getFullDomain(slug, type);

    // ШАГ 1: Удалить все DNS записи
    await this.deleteAllDnsRecords(subdomainFqdn);

    // ШАГ 2: Удалить поддомен
    const deleted = await this.deleteSubdomain(subdomainFqdn);

    return deleted;
  }

  // ============================================================================
  // LEGACY МЕТОДЫ (для обратной совместимости)
  // ============================================================================

  /**
   * @deprecated Используйте registerSubdomain()
   * Создать A-запись для субдомена платформы
   */
  async createSubdomainRecord(subdomain: string): Promise<number | null> {
    this.logger.warn(
      "createSubdomainRecord() is deprecated. Use registerSubdomain() instead."
    );

    // Получаем slug и type из subdomain формата "myshop.shops"
    const parts = subdomain.split(".");
    if (parts.length !== 2) {
      this.logger.error(
        `Invalid subdomain format: ${subdomain}. Expected: slug.type`
      );
      return null;
    }

    const [slug, type] = parts;
    const result = await this.registerSubdomain(slug, type);

    return result.success ? result.dnsRecordId || null : null;
  }

  /**
   * @deprecated Используйте unregisterSubdomain()
   * Удалить DNS запись для субдомена
   */
  async deleteSubdomainRecord(subdomain: string): Promise<boolean> {
    this.logger.warn(
      "deleteSubdomainRecord() is deprecated. Use unregisterSubdomain() instead."
    );

    // Получаем slug и type из subdomain формата "myshop.shops"
    const parts = subdomain.split(".");
    if (parts.length !== 2) {
      this.logger.error(
        `Invalid subdomain format: ${subdomain}. Expected: slug.type`
      );
      return false;
    }

    const [slug, type] = parts;
    return await this.unregisterSubdomain(slug, type);
  }

  /**
   * @deprecated Используйте getDnsRecords()
   * Получить все DNS записи базового домена
   */
  async getRecords(): Promise<TimewebDnsRecord[]> {
    return this.getDnsRecords(this.baseDomain);
  }

  /**
   * @deprecated Используйте findSubdomain() или getDnsRecords()
   * Найти DNS запись по субдомену и типу
   */
  async findRecord(
    subdomain: string,
    type: string
  ): Promise<TimewebDnsRecord | null> {
    try {
      const records = await this.getDnsRecords(this.baseDomain);
      return (
        records.find((r) => {
          if (r.type !== type) return false;
          const recordSubdomain = r.data.subdomain || "";
          return recordSubdomain.toLowerCase() === subdomain.toLowerCase();
        }) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * @deprecated Используйте subdomainExists()
   * Проверить существование DNS записи
   */
  async recordExists(subdomain: string): Promise<boolean> {
    const record = await this.findRecord(subdomain, "A");
    return record !== null;
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Получить полный домен субдомена
   *
   * @param slug - Slug сущности (например: "myshop")
   * @param type - Тип субдомена ("shops", "booking", "pages")
   * @returns Полный домен (например: "myshop.shops.botmanagertest.online")
   */
  getFullDomain(slug: string, type: string): string {
    return `${slug}.${type}.${this.baseDomain}`;
  }

  /**
   * Получить субдомен для Timeweb (без базового домена)
   *
   * @param slug - Slug сущности
   * @param type - Тип субдомена
   * @returns Субдомен (например: "myshop.shops")
   */
  getSubdomain(slug: string, type: string): string {
    return `${slug}.${type}`;
  }

  /**
   * Извлечь относительное имя из FQDN (убрать базовый домен)
   *
   * @param fqdn - Полный FQDN (например: "test.pages.botmanagertest.online")
   * @returns Относительное имя (например: "test.pages")
   */
  private extractRelativeName(fqdn: string): string {
    const suffix = `.${this.baseDomain}`;
    if (fqdn.toLowerCase().endsWith(suffix.toLowerCase())) {
      return fqdn.slice(0, -suffix.length);
    }
    // Если суффикс не найден, возвращаем как есть
    return fqdn;
  }

  /**
   * Получить базовый домен
   */
  getBaseDomain(): string {
    return this.baseDomain;
  }

  /**
   * Получить IP адрес Frontend сервера
   */
  getFrontendIp(): string {
    return this.frontendIp;
  }

  /**
   * Проверить доступность API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const domain = await this.getDomainInfo();
      return domain !== null;
    } catch {
      return false;
    }
  }

  /**
   * Логирование ошибок
   */
  private logError(method: string, error: any): void {
    const status = error.response?.status;
    const responseData = error.response?.data;
    this.logger.error(
      `${method} failed: status=${status}, message=${error.message}, response=${JSON.stringify(responseData)}`
    );
  }
}
