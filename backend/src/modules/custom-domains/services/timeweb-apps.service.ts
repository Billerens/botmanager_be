import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

// ============================================================================
// ИНТЕРФЕЙСЫ TIMEWEB APPS API
// ============================================================================

/**
 * Домен приложения Timeweb
 */
export interface TimewebAppDomain {
  fqdn: string;
}

/**
 * Приложение Timeweb
 */
export interface TimewebApp {
  id: number;
  type: "frontend" | "backend";
  name: string;
  status:
    | "active"
    | "paused"
    | "no_paid"
    | "deploy"
    | "failure"
    | "startup_error"
    | "new"
    | "reboot";
  ip: string | null;
  domains: TimewebAppDomain[];
  branch_name: string;
  is_auto_deploy: boolean;
  commit_sha: string;
  comment: string | null;
  env_version: string | null;
  build_cmd: string;
  run_cmd: string | null;
  index_dir: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ответ API на получение списка приложений
 */
interface TimewebAppsListResponse {
  apps: TimewebApp[];
  meta: {
    total: number;
  };
}

/**
 * Ответ API на получение приложения
 */
interface TimewebAppResponse {
  app: TimewebApp;
}

/**
 * Результат деплоя
 */
export interface DeployResult {
  success: boolean;
  appId?: number;
  appName?: string;
  error?: string;
  triggeredAt?: Date;
}

/**
 * Информация о планировщике редеплоя
 */
export interface RedeployScheduleInfo {
  /** ID приложения фронтенда (null если не найдено) */
  frontendAppId: number | null;
  /** Имя приложения фронтенда */
  frontendAppName: string | null;
  /** Время последнего редеплоя */
  lastRedeployAt: Date | null;
  /** Время следующего планового редеплоя */
  nextRedeployAt: Date | null;
  /** Интервал редеплоя в часах */
  redeployIntervalHours: number;
  /** Активен ли планировщик */
  isActive: boolean;
}

@Injectable()
export class TimewebAppsService implements OnModuleInit {
  private readonly logger = new Logger(TimewebAppsService.name);
  private client: AxiosInstance;

  /** IP адрес Frontend сервера (для поиска приложения) */
  private readonly frontendIp: string;

  /** Интервал редеплоя в часах */
  private readonly redeployIntervalHours: number;

  /** Кэшированный ID приложения фронтенда */
  private cachedFrontendAppId: number | null = null;
  private cachedFrontendAppName: string | null = null;

  /** Время последнего редеплоя */
  private lastRedeployAt: Date | null = null;

  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiToken = this.configService.get<string>("TIMEWEB_API_TOKEN");
    this.apiUrl =
      this.configService.get<string>("TIMEWEB_API_URL") ||
      "https://api.timeweb.cloud/api/v1";

    this.frontendIp = this.configService.get<string>("FRONTEND_IP") || "";
    this.redeployIntervalHours =
      this.configService.get<number>("TIMEWEB_REDEPLOY_INTERVAL_HOURS") || 4;

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 60000, // 60 секунд для деплоя
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    // Добавляем interceptors для подробного логирования
    this.setupLoggingInterceptors();

    this.logger.log(
      `Timeweb Apps configured: apiUrl=${this.apiUrl}, frontendIp=${this.frontendIp || "NOT SET"}, redeployInterval=${this.redeployIntervalHours}h`
    );
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
        const fullUrl = config.baseURL
          ? `${config.baseURL}${url}`
          : url;
        const params = config.params
          ? JSON.stringify(config.params)
          : "none";
        const data = config.data ? JSON.stringify(config.data) : "none";

        this.logger.log(
          `🔵 [TIMEWEB APPS API REQUEST] ${method} ${fullUrl}` +
            (params !== "none" ? ` | Query: ${params}` : "") +
            (data !== "none" ? ` | Body: ${data}` : "")
        );

        return config;
      },
      (error) => {
        this.logger.error(
          `🔴 [TIMEWEB APPS API REQUEST ERROR] ${error.message}`,
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
          `🟢 [TIMEWEB APPS API RESPONSE] ${method} ${fullUrl} | Status: ${status} | Response: ${responseData}`
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
          `🔴 [TIMEWEB APPS API RESPONSE ERROR] ${method} ${fullUrl} | Status: ${status} | Message: ${message} | Response: ${responseData}`
        );

        return Promise.reject(error);
      }
    );
  }

  async onModuleInit() {
    if (!this.frontendIp) {
      this.logger.warn(
        "FRONTEND_IP not configured. Auto-redeploy will not work."
      );
      return;
    }

    this.logger.log(`Searching for frontend app with IP: ${this.frontendIp}`);

    // Пробуем найти приложение фронтенда при старте
    try {
      // Получаем список всех приложений для диагностики
      const allApps = await this.getApps();
      this.logger.debug(
        `Found ${allApps.length} apps in Timeweb. ` +
          `Apps with IPs: ${
            allApps
              .filter((a) => a.ip)
              .map((a) => `${a.name}(${a.ip})`)
              .join(", ") || "none"
          }`
      );

      const app = await this.findFrontendApp();
      if (app) {
        this.cachedFrontendAppId = app.id;
        this.cachedFrontendAppName = app.name;
        this.logger.log(
          `Frontend app found: id=${app.id}, name="${app.name}", ` +
            `status="${app.status}", IP=${app.ip}, ` +
            `domains=[${app.domains.map((d) => d.fqdn).join(", ")}]`
        );
      } else {
        this.logger.warn(
          `Frontend app not found by IP ${this.frontendIp}. ` +
            `Available apps with IPs: ${
              allApps
                .filter((a) => a.ip)
                .map((a) => a.ip)
                .join(", ") || "none"
            }. ` +
            `Auto-redeploy will not work.`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to find frontend app: ${error.message}. ` +
          `Stack: ${error.stack}. Auto-redeploy may not work.`
      );
    }
  }

  // ============================================================================
  // РАБОТА С ПРИЛОЖЕНИЯМИ
  // ============================================================================

  /**
   * Получить список всех приложений
   */
  async getApps(): Promise<TimewebApp[]> {
    try {
      const response = await this.client.get<TimewebAppsListResponse>("/apps");
      return response.data.apps || [];
    } catch (error) {
      this.logError("getApps", error);
      return [];
    }
  }

  /**
   * Получить приложение по ID
   */
  async getAppById(appId: number): Promise<TimewebApp | null> {
    try {
      const response = await this.client.get<TimewebAppResponse>(
        `/apps/${appId}`
      );
      return response.data.app || null;
    } catch (error) {
      this.logError(`getAppById(${appId})`, error);
      return null;
    }
  }

  /**
   * Найти приложение по IP адресу
   */
  async findAppByIp(ip: string): Promise<TimewebApp | null> {
    const apps = await this.getApps();
    return apps.find((app) => app.ip === ip) || null;
  }

  /**
   * Найти приложение фронтенда (по FRONTEND_IP)
   */
  async findFrontendApp(): Promise<TimewebApp | null> {
    if (!this.frontendIp) {
      return null;
    }

    // Используем кэш если есть
    if (this.cachedFrontendAppId) {
      const app = await this.getAppById(this.cachedFrontendAppId);
      if (app && app.ip === this.frontendIp) {
        return app;
      }
      // Кэш невалиден, сбрасываем
      this.cachedFrontendAppId = null;
      this.cachedFrontendAppName = null;
    }

    // Ищем по IP
    const app = await this.findAppByIp(this.frontendIp);
    if (app) {
      this.cachedFrontendAppId = app.id;
      this.cachedFrontendAppName = app.name;
    }

    return app;
  }

  // ============================================================================
  // ДЕПЛОЙ
  // ============================================================================

  /**
   * Запустить деплой приложения
   *
   * @param appId - ID приложения
   * @param commitSha - (опционально) SHA коммита для деплоя. Если не указан, используется текущий commit_sha приложения
   */
  async deployApp(appId: number, commitSha?: string): Promise<DeployResult> {
    try {
      // Если commit_sha не указан, получаем текущий commit_sha из приложения
      let finalCommitSha = commitSha;
      if (!finalCommitSha) {
        const app = await this.getAppById(appId);
        if (app && app.commit_sha) {
          finalCommitSha = app.commit_sha;
          this.logger.log(
            `Using current commit_sha from app: ${finalCommitSha}`
          );
        } else {
          // Если не удалось получить commit_sha, используем пустую строку
          // (API может принять это как "деплой текущего коммита")
          finalCommitSha = "";
          this.logger.warn(
            `Could not get commit_sha from app ${appId}, using empty string`
          );
        }
      }

      const requestUrl = `/apps/${appId}/deploy`;
      const requestBody = { commit_sha: finalCommitSha };

      this.logger.log(
        `Deploying app ${appId}: POST ${this.apiUrl}${requestUrl}, commit_sha=${finalCommitSha || "current"}`
      );

      await this.client.post(requestUrl, requestBody);

      this.logger.log(`Deploy triggered successfully for app ${appId}`);

      return {
        success: true,
        appId,
        triggeredAt: new Date(),
      };
    } catch (error) {
      this.logError(`deployApp(${appId})`, error);
      return {
        success: false,
        appId,
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Запустить редеплой приложения фронтенда
   *
   * Автоматически находит приложение по FRONTEND_IP и запускает деплой.
   */
  async redeployFrontend(): Promise<DeployResult> {
    if (!this.frontendIp) {
      return {
        success: false,
        error: "FRONTEND_IP not configured",
      };
    }

    const app = await this.findFrontendApp();
    if (!app) {
      return {
        success: false,
        error: `Frontend app not found by IP ${this.frontendIp}`,
      };
    }

    // Проверяем статус приложения
    if (app.status === "deploy") {
      this.logger.log(
        `Frontend app ${app.id} is already deploying, skipping...`
      );
      return {
        success: true,
        appId: app.id,
        appName: app.name,
        triggeredAt: new Date(),
      };
    }

    // Используем текущий commit_sha приложения для редеплоя
    const result = await this.deployApp(app.id, app.commit_sha);

    if (result.success) {
      this.lastRedeployAt = new Date();
      result.appName = app.name;
    }

    return result;
  }

  // ============================================================================
  // ИНФОРМАЦИЯ О РАСПИСАНИИ
  // ============================================================================

  /**
   * Получить информацию о планировщике редеплоя
   */
  getScheduleInfo(): RedeployScheduleInfo {
    const nextRedeployAt = this.calculateNextRedeployTime();

    return {
      frontendAppId: this.cachedFrontendAppId,
      frontendAppName: this.cachedFrontendAppName,
      lastRedeployAt: this.lastRedeployAt,
      nextRedeployAt,
      redeployIntervalHours: this.redeployIntervalHours,
      isActive: !!this.cachedFrontendAppId && !!this.frontendIp,
    };
  }

  /**
   * Рассчитать время следующего планового редеплоя
   *
   * Редеплой происходит каждые N часов, выровненные по UTC:
   * Если интервал 4 часа: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
   */
  calculateNextRedeployTime(): Date | null {
    if (!this.cachedFrontendAppId) {
      return null;
    }

    const now = new Date();
    const currentHour = now.getUTCHours();
    const intervalHours = this.redeployIntervalHours;

    // Находим следующий выровненный час
    const nextSlotHour =
      Math.ceil((currentHour + 1) / intervalHours) * intervalHours;

    const nextRedeploy = new Date(now);
    nextRedeploy.setUTCHours(nextSlotHour % 24, 0, 0, 0);

    // Если следующий слот уже прошёл сегодня (nextSlotHour >= 24), добавляем день
    if (nextSlotHour >= 24) {
      nextRedeploy.setUTCDate(nextRedeploy.getUTCDate() + 1);
    }

    // Если время в прошлом (что-то пошло не так), вернём следующий интервал
    if (nextRedeploy <= now) {
      nextRedeploy.setUTCHours(nextRedeploy.getUTCHours() + intervalHours);
    }

    return nextRedeploy;
  }

  /**
   * Получить секунды до следующего редеплоя
   */
  getSecondsUntilNextRedeploy(): number | null {
    const nextRedeploy = this.calculateNextRedeployTime();
    if (!nextRedeploy) {
      return null;
    }

    const now = new Date();
    return Math.max(
      0,
      Math.floor((nextRedeploy.getTime() - now.getTime()) / 1000)
    );
  }

  /**
   * Обновить время последнего редеплоя (вызывается после успешного редеплоя)
   */
  setLastRedeployTime(time: Date): void {
    this.lastRedeployAt = time;
  }

  /**
   * Получить интервал редеплоя в часах
   */
  getRedeployIntervalHours(): number {
    return this.redeployIntervalHours;
  }

  /**
   * Получить IP адрес фронтенда (для диагностики)
   */
  getFrontendIp(): string {
    return this.frontendIp;
  }

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================================

  /**
   * Проверить доступность API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const apps = await this.getApps();
      return apps.length >= 0;
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
