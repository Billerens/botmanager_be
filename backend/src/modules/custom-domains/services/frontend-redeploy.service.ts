import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TimewebAppsService } from "./timeweb-apps.service";

/**
 * Сервис автоматического редеплоя фронтенда
 *
 * Проблема:
 * После создания нового субдомена в Timeweb SSL-сертификат не активируется
 * до передеплоя контейнера фронтенда.
 *
 * Решение:
 * Автоматический редеплой фронтенда каждые 4 часа (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
 * для активации SSL-сертификатов новых субдоменов.
 *
 * Расписание выровнено по UTC для предсказуемости.
 */
@Injectable()
export class FrontendRedeployService implements OnModuleInit {
  private readonly logger = new Logger(FrontendRedeployService.name);

  /** Флаг активности планировщика */
  private isSchedulerActive = false;

  constructor(private readonly timewebAppsService: TimewebAppsService) {}

  async onModuleInit() {
    const scheduleInfo = this.timewebAppsService.getScheduleInfo();

    // Детальное логирование для диагностики
    this.logger.log(
      `Initializing frontend redeploy scheduler. ` +
        `FRONTEND_IP configured: ${scheduleInfo.isActive ? "YES" : "NO"}, ` +
        `Frontend app ID: ${scheduleInfo.frontendAppId || "NOT FOUND"}, ` +
        `Frontend app name: ${scheduleInfo.frontendAppName || "NOT FOUND"}`
    );

    if (scheduleInfo.isActive) {
      this.isSchedulerActive = true;
      this.logger.log(
        `Frontend auto-redeploy scheduler ACTIVE. ` +
          `App: ${scheduleInfo.frontendAppName} (id: ${scheduleInfo.frontendAppId}). ` +
          `Interval: every ${scheduleInfo.redeployIntervalHours} hours. ` +
          `Next redeploy: ${scheduleInfo.nextRedeployAt?.toISOString() || "unknown"}`
      );
    } else {
      // Детальное логирование причин неактивности
      const frontendIp = this.timewebAppsService.getFrontendIp() || "NOT SET";
      const cachedAppId = scheduleInfo.frontendAppId;

      this.logger.warn(
        "Frontend auto-redeploy scheduler INACTIVE. " +
          `FRONTEND_IP=${frontendIp}, ` +
          `Cached app ID=${cachedAppId || "null"}, ` +
          `Cached app name=${scheduleInfo.frontendAppName || "null"}. ` +
          "Either FRONTEND_IP is not configured or frontend app was not found during initialization."
      );

      // Попытка найти приложение заново для диагностики и активации
      try {
        const app = await this.timewebAppsService.findFrontendApp();
        if (app) {
          // Если приложение найдено, активируем планировщик
          const newScheduleInfo = this.timewebAppsService.getScheduleInfo();
          if (newScheduleInfo.isActive) {
            this.isSchedulerActive = true;
            this.logger.log(
              `Frontend app found on retry: id=${app.id}, name="${app.name}", ` +
                `IP=${app.ip}, status="${app.status}". ` +
                `Scheduler ACTIVATED. Interval: every ${newScheduleInfo.redeployIntervalHours} hours. ` +
                `Next redeploy: ${newScheduleInfo.nextRedeployAt?.toISOString() || "unknown"}`
            );
          } else {
            this.logger.warn(
              `Frontend app found on retry: id=${app.id}, name="${app.name}", ` +
                `IP=${app.ip}, status="${app.status}". ` +
                `But scheduler remains inactive (isActive=${newScheduleInfo.isActive}, ` +
                `cachedAppId=${newScheduleInfo.frontendAppId}, frontendIp=${frontendIp}).`
            );
          }
        } else {
          this.logger.warn(
            `Frontend app not found by IP ${frontendIp}. ` +
              "Please verify FRONTEND_IP configuration or check Timeweb Apps API."
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to retry finding frontend app: ${error.message}`
        );
      }
    }
  }

  /**
   * Автоматический редеплой каждые 4 часа
   *
   * Расписание: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
   *
   * Cron: "0 0 0,4,8,12,16,20 * * *"
   * - Секунда: 0
   * - Минута: 0
   * - Час: 0, 4, 8, 12, 16, 20
   * - День месяца: *
   * - Месяц: *
   * - День недели: *
   */
  @Cron("0 0 0,4,8,12,16,20 * * *", {
    name: "frontend-auto-redeploy",
    timeZone: "UTC",
  })
  async scheduledRedeploy(): Promise<void> {
    if (!this.isSchedulerActive) {
      this.logger.debug("Scheduled redeploy skipped: scheduler is inactive");
      return;
    }

    this.logger.log("Starting scheduled frontend redeploy...");

    try {
      const result = await this.timewebAppsService.redeployFrontend();

      if (result.success) {
        this.logger.log(
          `Scheduled redeploy SUCCESS: app="${result.appName}" (id: ${result.appId})`
        );
      } else {
        this.logger.error(`Scheduled redeploy FAILED: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Scheduled redeploy ERROR: ${error.message}`);
    }
  }

  /**
   * Ручной запуск редеплоя (для административных целей)
   */
  async triggerManualRedeploy(): Promise<{
    success: boolean;
    message: string;
    appId?: number;
    appName?: string;
  }> {
    this.logger.log("Manual redeploy triggered");

    const result = await this.timewebAppsService.redeployFrontend();

    if (result.success) {
      return {
        success: true,
        message: `Редеплой запущен для приложения "${result.appName}"`,
        appId: result.appId,
        appName: result.appName,
      };
    } else {
      return {
        success: false,
        message: result.error || "Неизвестная ошибка",
      };
    }
  }

  /**
   * Получить статус планировщика
   */
  getSchedulerStatus(): {
    isActive: boolean;
    frontendAppId: number | null;
    frontendAppName: string | null;
    lastRedeployAt: Date | null;
    nextRedeployAt: Date | null;
    secondsUntilNextRedeploy: number | null;
    intervalHours: number;
  } {
    const scheduleInfo = this.timewebAppsService.getScheduleInfo();
    const secondsUntilNext =
      this.timewebAppsService.getSecondsUntilNextRedeploy();

    return {
      isActive: this.isSchedulerActive,
      frontendAppId: scheduleInfo.frontendAppId,
      frontendAppName: scheduleInfo.frontendAppName,
      lastRedeployAt: scheduleInfo.lastRedeployAt,
      nextRedeployAt: scheduleInfo.nextRedeployAt,
      secondsUntilNextRedeploy: secondsUntilNext,
      intervalHours: scheduleInfo.redeployIntervalHours,
    };
  }

  /**
   * Активировать/деактивировать планировщик
   */
  setSchedulerActive(active: boolean): void {
    this.isSchedulerActive = active;
    this.logger.log(`Scheduler ${active ? "ACTIVATED" : "DEACTIVATED"}`);
  }

  /**
   * Перепроверить и активировать планировщик, если приложение найдено
   *
   * Используется для активации планировщика после того, как приложение было найдено
   * (например, если при инициализации оно еще не было доступно)
   */
  async recheckAndActivate(): Promise<{
    activated: boolean;
    message: string;
    appId?: number;
    appName?: string;
  }> {
    this.logger.log("Rechecking scheduler status...");

    const scheduleInfo = this.timewebAppsService.getScheduleInfo();

    if (scheduleInfo.isActive && !this.isSchedulerActive) {
      // Приложение найдено, но планировщик неактивен - активируем
      this.isSchedulerActive = true;
      this.logger.log(
        `Scheduler ACTIVATED after recheck. ` +
          `App: ${scheduleInfo.frontendAppName} (id: ${scheduleInfo.frontendAppId}). ` +
          `Interval: every ${scheduleInfo.redeployIntervalHours} hours. ` +
          `Next redeploy: ${scheduleInfo.nextRedeployAt?.toISOString() || "unknown"}`
      );

      return {
        activated: true,
        message: `Планировщик активирован. Приложение: ${scheduleInfo.frontendAppName} (ID: ${scheduleInfo.frontendAppId})`,
        appId: scheduleInfo.frontendAppId || undefined,
        appName: scheduleInfo.frontendAppName || undefined,
      };
    } else if (scheduleInfo.isActive && this.isSchedulerActive) {
      return {
        activated: false,
        message: "Планировщик уже активен",
        appId: scheduleInfo.frontendAppId || undefined,
        appName: scheduleInfo.frontendAppName || undefined,
      };
    } else {
      // Попробуем найти приложение заново
      try {
        const app = await this.timewebAppsService.findFrontendApp();
        const newScheduleInfo = this.timewebAppsService.getScheduleInfo();

        if (newScheduleInfo.isActive && !this.isSchedulerActive) {
          this.isSchedulerActive = true;
          this.logger.log(
            `Scheduler ACTIVATED after finding app. ` +
              `App: ${app?.name} (id: ${app?.id}). ` +
              `Interval: every ${newScheduleInfo.redeployIntervalHours} hours.`
          );

          return {
            activated: true,
            message: `Планировщик активирован после поиска приложения. Приложение: ${app?.name} (ID: ${app?.id})`,
            appId: app?.id,
            appName: app?.name,
          };
        } else if (app) {
          return {
            activated: false,
            message: `Приложение найдено (${app.name}, ID: ${app.id}), но планировщик не может быть активирован. Проверьте настройки.`,
            appId: app.id,
            appName: app.name,
          };
        } else {
          const frontendIp = this.timewebAppsService.getFrontendIp();
          return {
            activated: false,
            message: `Приложение не найдено по IP ${frontendIp}. Проверьте настройку FRONTEND_IP.`,
          };
        }
      } catch (error: any) {
        return {
          activated: false,
          message: `Ошибка при поиске приложения: ${error.message}`,
        };
      }
    }
  }
}
