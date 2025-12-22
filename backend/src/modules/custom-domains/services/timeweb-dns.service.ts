import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

/**
 * DNS запись Timeweb (v1 API)
 */
interface TimewebDnsRecord {
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
 * Ответ Timeweb API на запрос записей (v1 API)
 */
interface TimewebDnsResponse {
  dns_records: TimewebDnsRecord[];
  meta?: {
    total: number;
  };
}

/**
 * Ответ Timeweb API на создание записи
 */
interface TimewebCreateResponse {
  dns_record: TimewebDnsRecord;
}

/**
 * Конфигурация для создания DNS записи
 */
export interface CreateDnsRecordConfig {
  /** Полный субдомен (например: myshop.shops) */
  subdomain: string;
  /** IP адрес или CNAME target */
  value: string;
  /** Тип записи: A или CNAME */
  type: "A" | "CNAME";
  /** TTL в секундах (по умолчанию 600) */
  ttl?: number;
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

    this.logger.log(
      `Timeweb DNS configured: apiUrl=${this.apiUrl}, baseDomain=${this.baseDomain}, frontendIp=${this.frontendIp || "NOT SET"}`
    );
  }

  async onModuleInit() {
    // Проверяем доступность API при старте
    try {
      const records = await this.getRecords();
      this.logger.log(
        `Timeweb DNS API available for domain ${this.baseDomain}. Found ${records.length} existing records.`
      );
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      this.logger.warn(
        `Timeweb DNS API not available: status=${status}, message=${error.message}, response=${JSON.stringify(responseData)}. Subdomain management will not work.`
      );
    }
  }

  /**
   * Получить все DNS записи домена
   */
  async getRecords(): Promise<TimewebDnsRecord[]> {
    try {
      // v1 API: GET /domains/{fqdn}/dns-records
      const response = await this.client.get<TimewebDnsResponse>(
        `/domains/${this.baseDomain}/dns-records`
      );
      return response.data.dns_records || [];
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      this.logger.error(
        `Failed to get DNS records: status=${status}, message=${error.message}, response=${JSON.stringify(responseData)}`
      );
      throw error;
    }
  }

  /**
   * Создать A-запись для субдомена платформы
   *
   * @param subdomain - Субдомен без базового домена (например: "myshop.shops")
   * @returns ID созданной записи или null при ошибке
   */
  async createSubdomainRecord(subdomain: string): Promise<number | null> {
    if (!this.frontendIp) {
      this.logger.error(
        "FRONTEND_IP not configured. Cannot create DNS records for subdomains."
      );
      return null;
    }

    try {
      // Проверяем, существует ли уже такая запись
      const existing = await this.findRecord(subdomain, "A");
      if (existing) {
        this.logger.log(
          `DNS record for ${subdomain}.${this.baseDomain} already exists (id: ${existing.id})`
        );
        return existing.id;
      }

      // Формат v1 API:
      // URL: /domains/{fullFqdn}/dns-records (полный FQDN создаваемой записи)
      // Body: { type, value } - без subdomain!
      const fullDomain = `${subdomain}.${this.baseDomain}`;
      const requestUrl = `/domains/${fullDomain}/dns-records`;
      const requestBody = {
        type: "A",
        value: this.frontendIp,
      };

      this.logger.log(
        `Creating DNS record: POST ${this.apiUrl}${requestUrl} body=${JSON.stringify(requestBody)}`
      );

      const response = await this.client.post<TimewebCreateResponse>(
        requestUrl,
        JSON.stringify(requestBody)
      );

      const recordId = response.data.dns_record?.id;
      this.logger.log(
        `Created DNS A-record for ${fullDomain} → ${this.frontendIp} (id: ${recordId})`
      );

      return recordId;
    } catch (error) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      this.logger.error(
        `Failed to create DNS record for ${subdomain}: status=${status}, message=${error.message}, response=${JSON.stringify(responseData)}`
      );
      return null;
    }
  }

  /**
   * Удалить DNS запись для субдомена
   *
   * @param subdomain - Субдомен без базового домена (например: "myshop.shops")
   * @returns true если удалена или не существовала, false при ошибке
   */
  async deleteSubdomainRecord(subdomain: string): Promise<boolean> {
    try {
      // Находим запись по субдомену
      const record = await this.findRecord(subdomain, "A");
      const fullDomain = `${subdomain}.${this.baseDomain}`;

      if (!record) {
        this.logger.log(
          `DNS record for ${fullDomain} not found, nothing to delete`
        );
        return true;
      }

      // v1 API: DELETE /domains/{fqdn}/dns-records/{record_id}
      // Используем полный FQDN записи
      await this.client.delete(
        `/domains/${fullDomain}/dns-records/${record.id}`
      );

      this.logger.log(
        `Deleted DNS record for ${fullDomain} (id: ${record.id})`
      );
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        // Запись уже не существует
        return true;
      }
      const status = error.response?.status;
      const responseData = error.response?.data;
      this.logger.error(
        `Failed to delete DNS record for ${subdomain}: status=${status}, message=${error.message}, response=${JSON.stringify(responseData)}`
      );
      return false;
    }
  }

  /**
   * Найти DNS запись по субдомену и типу
   */
  async findRecord(
    subdomain: string,
    type: string
  ): Promise<TimewebDnsRecord | null> {
    try {
      const records = await this.getRecords();
      return (
        records.find((r) => {
          if (r.type !== type) return false;
          // subdomain может быть null для корневого домена
          const recordSubdomain = r.data.subdomain || "";
          return recordSubdomain.toLowerCase() === subdomain.toLowerCase();
        }) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Проверить существование DNS записи
   */
  async recordExists(subdomain: string): Promise<boolean> {
    const record = await this.findRecord(subdomain, "A");
    return record !== null;
  }

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
   * Проверить доступность API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getRecords();
      return true;
    } catch {
      return false;
    }
  }
}
