import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

/**
 * DNS запись Timeweb
 */
interface TimewebDnsRecord {
  id: number;
  type: string;
  ttl: number;
  data: {
    subdomain: string;
    value: string;
    priority?: number;
  };
}

/**
 * Ответ Timeweb API на запрос записей
 */
interface TimewebDnsResponse {
  dns_records: TimewebDnsRecord[];
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

  /** IP адрес прокси-сервера */
  private readonly proxyIp: string;

  constructor(private readonly configService: ConfigService) {
    const apiToken = this.configService.get<string>("TIMEWEB_API_TOKEN");
    const apiUrl =
      this.configService.get<string>("TIMEWEB_API_URL") ||
      "https://api.timeweb.cloud/api/v1";

    this.baseDomain =
      this.configService.get<string>("BASE_DOMAIN") || "botmanagertest.online";
    this.proxyIp =
      this.configService.get<string>("PROXY_IP") || "185.104.114.135";

    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async onModuleInit() {
    // Проверяем доступность API при старте
    try {
      await this.getRecords();
      this.logger.log(
        `Timeweb DNS API available for domain ${this.baseDomain}`
      );
    } catch (error) {
      this.logger.warn(
        `Timeweb DNS API not available: ${error.message}. Subdomain management will not work.`
      );
    }
  }

  /**
   * Получить все DNS записи домена
   */
  async getRecords(): Promise<TimewebDnsRecord[]> {
    try {
      const response = await this.client.get<TimewebDnsResponse>(
        `/domains/${this.baseDomain}/dns-records`
      );
      return response.data.dns_records || [];
    } catch (error) {
      this.logger.error(`Failed to get DNS records: ${error.message}`);
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
    try {
      // Проверяем, существует ли уже такая запись
      const existing = await this.findRecord(subdomain, "A");
      if (existing) {
        this.logger.log(
          `DNS record for ${subdomain}.${this.baseDomain} already exists (id: ${existing.id})`
        );
        return existing.id;
      }

      const response = await this.client.post<TimewebCreateResponse>(
        `/domains/${this.baseDomain}/dns-records`,
        {
          type: "A",
          subdomain: subdomain,
          value: this.proxyIp,
          ttl: 600, // 10 минут - быстрее распространение
        }
      );

      const recordId = response.data.dns_record?.id;
      this.logger.log(
        `Created DNS A-record for ${subdomain}.${this.baseDomain} → ${this.proxyIp} (id: ${recordId})`
      );

      return recordId;
    } catch (error) {
      this.logger.error(
        `Failed to create DNS record for ${subdomain}: ${error.message}`
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

      if (!record) {
        this.logger.log(
          `DNS record for ${subdomain}.${this.baseDomain} not found, nothing to delete`
        );
        return true;
      }

      await this.client.delete(
        `/domains/${this.baseDomain}/dns-records/${record.id}`
      );

      this.logger.log(
        `Deleted DNS record for ${subdomain}.${this.baseDomain} (id: ${record.id})`
      );
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        // Запись уже не существует
        return true;
      }
      this.logger.error(
        `Failed to delete DNS record for ${subdomain}: ${error.message}`
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
        records.find(
          (r) =>
            r.type === type &&
            r.data.subdomain.toLowerCase() === subdomain.toLowerCase()
        ) || null
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

