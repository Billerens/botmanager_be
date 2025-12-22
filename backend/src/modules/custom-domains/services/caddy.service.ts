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
 * Сервис для работы с Caddy Admin API
 *
 * ВАЖНО: Для субдоменов платформы (*.shops, *.booking, *.pages)
 * этот сервис НЕ используется! Caddy роутит их по wildcard правилам.
 *
 * Этот сервис нужен только для кастомных доменов пользователей
 * (например: myshop.com → shop-uuid)
 */
@Injectable()
export class CaddyService implements OnModuleInit {
  private readonly logger = new Logger(CaddyService.name);
  private client: AxiosInstance;
  private readonly adminUrl: string;
  private readonly backendUpstream: string;

  constructor(private readonly configService: ConfigService) {
    this.adminUrl =
      this.configService.get<string>("CADDY_ADMIN_URL") || "http://caddy:2019";
    this.backendUpstream =
      this.configService.get<string>("BACKEND_UPSTREAM") || "backend:3000";

    this.client = axios.create({
      baseURL: this.adminUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async onModuleInit() {
    try {
      await this.healthCheck();
      this.logger.log(`Caddy Admin API available at ${this.adminUrl}`);
    } catch (error) {
      this.logger.warn(
        `Caddy Admin API not available at ${this.adminUrl}. ` +
          `Custom domains will not work until Caddy is running.`
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
   * Используется ТОЛЬКО для кастомных доменов пользователей (myshop.com).
   * Субдомены платформы роутятся по wildcard правилам в Caddyfile.
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
      await this.client.post("/config/apps/http/servers/srv0/routes", route);
      this.logger.log(`Added Caddy route for ${config.domain}`);
      return true;
    } catch (error) {
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
   */
  async removeRoute(domain: string): Promise<boolean> {
    const routeId = this.getRouteId(domain);

    try {
      await this.client.delete(`/id/${routeId}`);
      this.logger.log(`Removed Caddy route for ${domain}`);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return true; // Уже удалён
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
    return `custom_domain_${domain.replace(/\./g, "_")}`;
  }
}
