import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { DomainTargetType } from "../enums/domain-status.enum";

interface CaddyRouteConfig {
  domain: string;
  targetType: DomainTargetType;
  targetId: string;
}

interface CaddyRoute {
  "@id": string;
  match: Array<{ host: string[] }>;
  handle: Array<{
    handler: string;
    upstreams?: Array<{ dial: string }>;
    headers?: {
      request?: {
        set?: Record<string, string[]>;
      };
    };
  }>;
  terminal?: boolean;
}

/**
 * TLS Automation Policy для Caddy
 * Используется для настройки DNS-01 challenge
 */
interface CaddyTlsPolicy {
  "@id"?: string;
  subjects: string[];
  issuers: Array<{
    module: string;
    challenges?: {
      dns?: {
        provider: {
          name: string;
          api_token?: string;
        };
      };
    };
  }>;
}

@Injectable()
export class CaddyService implements OnModuleInit {
  private readonly logger = new Logger(CaddyService.name);
  private client: AxiosInstance;
  private readonly adminUrl: string;
  private readonly backendUpstream: string;
  private readonly timewebApiToken: string;
  private readonly baseDomain: string;

  constructor(private readonly configService: ConfigService) {
    this.adminUrl =
      this.configService.get<string>("CADDY_ADMIN_URL") || "http://caddy:2019";
    this.backendUpstream =
      this.configService.get<string>("BACKEND_UPSTREAM") || "backend:3000";
    this.timewebApiToken =
      this.configService.get<string>("TIMEWEB_API_TOKEN") || "";
    this.baseDomain =
      this.configService.get<string>("BASE_DOMAIN") || "botmanagertest.online";

    this.client = axios.create({
      baseURL: this.adminUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async onModuleInit() {
    // Проверяем доступность Caddy при старте
    try {
      await this.healthCheck();
      this.logger.log(`Caddy Admin API available at ${this.adminUrl}`);
    } catch (error) {
      this.logger.warn(
        `Caddy Admin API not available at ${this.adminUrl}. Custom domains will not work until Caddy is running.`
      );
    }
  }

  /**
   * Проверка доступности Caddy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/config/");
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Добавить маршрут для кастомного домена
   *
   * Также добавляет TLS policy для DNS-01 challenge через Timeweb
   * если домен является субдоменом платформы
   */
  async addRoute(config: CaddyRouteConfig): Promise<boolean> {
    const routeId = this.getRouteId(config.domain);

    const route: CaddyRoute = {
      "@id": routeId,
      match: [{ host: [config.domain] }],
      handle: [
        {
          handler: "reverse_proxy",
          upstreams: [{ dial: this.backendUpstream }],
          headers: {
            request: {
              set: {
                "X-Custom-Domain": [config.domain],
                "X-Target-Type": [config.targetType],
                "X-Target-Id": [config.targetId],
                "X-Forwarded-Proto": ["https"],
              },
            },
          },
        },
      ],
      terminal: true,
    };

    try {
      // Добавляем TLS policy для DNS-01 challenge (для субдоменов платформы)
      if (this.isPlatformSubdomain(config.domain)) {
        await this.addTlsPolicy(config.domain);
      }

      // Пробуем добавить маршрут
      await this.client.post("/config/apps/http/servers/srv0/routes", route);

      this.logger.log(`Added Caddy route for ${config.domain}`);
      return true;
    } catch (error) {
      // Если маршрут уже существует, обновляем его
      if (error.response?.status === 400) {
        try {
          await this.updateRoute(config);
          return true;
        } catch (updateError) {
          this.logger.error(
            `Failed to update route for ${config.domain}`,
            updateError
          );
          return false;
        }
      }

      this.logger.error(`Failed to add route for ${config.domain}`, error);
      return false;
    }
  }

  /**
   * Проверить, является ли домен субдоменом платформы
   */
  private isPlatformSubdomain(domain: string): boolean {
    return (
      domain.endsWith(`.shops.${this.baseDomain}`) ||
      domain.endsWith(`.booking.${this.baseDomain}`) ||
      domain.endsWith(`.pages.${this.baseDomain}`)
    );
  }

  /**
   * Добавить TLS automation policy для домена
   * Использует DNS-01 challenge через Timeweb
   */
  private async addTlsPolicy(domain: string): Promise<boolean> {
    if (!this.timewebApiToken) {
      this.logger.warn(
        `TIMEWEB_API_TOKEN not set, skipping TLS policy for ${domain}`
      );
      return false;
    }

    const policyId = `tls_policy_${domain.replace(/\./g, "_")}`;

    const policy: CaddyTlsPolicy = {
      "@id": policyId,
      subjects: [domain],
      issuers: [
        {
          module: "acme",
          challenges: {
            dns: {
              provider: {
                name: "timeweb",
                api_token: this.timewebApiToken,
              },
            },
          },
        },
      ],
    };

    try {
      // Добавляем policy в automation policies
      await this.client.post("/config/apps/tls/automation/policies", policy);
      this.logger.log(`Added TLS policy for ${domain}`);
      return true;
    } catch (error) {
      // Policy может уже существовать - это не критично
      if (error.response?.status === 400) {
        this.logger.debug(`TLS policy for ${domain} already exists`);
        return true;
      }
      this.logger.warn(
        `Failed to add TLS policy for ${domain}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Удалить TLS policy для домена
   */
  private async removeTlsPolicy(domain: string): Promise<boolean> {
    const policyId = `tls_policy_${domain.replace(/\./g, "_")}`;

    try {
      await this.client.delete(`/id/${policyId}`);
      this.logger.log(`Removed TLS policy for ${domain}`);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return true; // Уже удалено
      }
      this.logger.warn(
        `Failed to remove TLS policy for ${domain}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Обновить существующий маршрут
   */
  async updateRoute(config: CaddyRouteConfig): Promise<boolean> {
    const routeId = this.getRouteId(config.domain);

    const route: CaddyRoute = {
      "@id": routeId,
      match: [{ host: [config.domain] }],
      handle: [
        {
          handler: "reverse_proxy",
          upstreams: [{ dial: this.backendUpstream }],
          headers: {
            request: {
              set: {
                "X-Custom-Domain": [config.domain],
                "X-Target-Type": [config.targetType],
                "X-Target-Id": [config.targetId],
                "X-Forwarded-Proto": ["https"],
              },
            },
          },
        },
      ],
      terminal: true,
    };

    try {
      await this.client.patch(`/id/${routeId}`, route);
      this.logger.log(`Updated Caddy route for ${config.domain}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update route for ${config.domain}`, error);
      return false;
    }
  }

  /**
   * Удалить маршрут для домена
   * Также удаляет TLS policy если это субдомен платформы
   */
  async removeRoute(domain: string): Promise<boolean> {
    const routeId = this.getRouteId(domain);

    try {
      // Удаляем маршрут
      await this.client.delete(`/id/${routeId}`);
      this.logger.log(`Removed Caddy route for ${domain}`);

      // Удаляем TLS policy если это субдомен платформы
      if (this.isPlatformSubdomain(domain)) {
        await this.removeTlsPolicy(domain);
      }

      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        // Маршрут уже удалён
        return true;
      }
      this.logger.error(`Failed to remove route for ${domain}`, error);
      return false;
    }
  }

  /**
   * Проверить существование маршрута
   */
  async routeExists(domain: string): Promise<boolean> {
    const routeId = this.getRouteId(domain);

    try {
      await this.client.get(`/id/${routeId}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Принудительное обновление SSL сертификата
   *
   * Caddy автоматически обновляет сертификаты, но мы можем
   * попробовать инициировать обновление, удалив кешированный сертификат
   */
  async forceRenewCertificate(domain: string): Promise<boolean> {
    try {
      // Удаляем сертификат из хранилища Caddy
      // Это заставит Caddy запросить новый при следующем запросе
      await this.client.delete(`/certificates/${domain}`);

      this.logger.log(`Initiated certificate renewal for ${domain}`);

      // Делаем запрос к домену чтобы инициировать получение нового сертификата
      await this.triggerCertificateIssuance(domain);

      return true;
    } catch (error) {
      this.logger.error(`Failed to renew certificate for ${domain}`, error);
      return false;
    }
  }

  /**
   * Инициировать получение сертификата через HTTPS запрос
   */
  private async triggerCertificateIssuance(domain: string): Promise<void> {
    try {
      await axios.get(`https://${domain}`, {
        timeout: 30000,
        httpsAgent: new (require("https").Agent)({
          rejectUnauthorized: false,
        }),
      });
    } catch {
      // Ошибка ожидаема если сертификат ещё не выдан
    }
  }

  /**
   * Получить список всех маршрутов
   */
  async getRoutes(): Promise<CaddyRoute[]> {
    try {
      const response = await this.client.get(
        "/config/apps/http/servers/srv0/routes"
      );
      return response.data || [];
    } catch (error) {
      this.logger.error("Failed to get routes", error);
      return [];
    }
  }

  /**
   * Генерация уникального ID маршрута
   */
  private getRouteId(domain: string): string {
    // Преобразуем домен в безопасный ID
    return `custom_domain_${domain.replace(/\./g, "_")}`;
  }
}
