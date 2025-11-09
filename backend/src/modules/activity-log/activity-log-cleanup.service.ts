import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ActivityLogService } from "./activity-log.service";

/**
 * Сервис для автоматической очистки старых записей activity log
 * Удаляет логи старше 30 дней (1 месяц)
 */
@Injectable()
export class ActivityLogCleanupService {
  private readonly logger = new Logger(ActivityLogCleanupService.name);

  constructor(private readonly activityLogService: ActivityLogService) {}

  /**
   * Автоматическая очистка старых логов
   * Запускается каждый день в 3:00 ночи
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldLogs(): Promise<void> {
    this.logger.log("Starting automatic cleanup of old activity logs...");

    try {
      const daysToKeep = 30; // Удаляем логи старше 30 дней (1 месяц)
      const deletedCount = await this.activityLogService.cleanup(daysToKeep);

      if (deletedCount > 0) {
        this.logger.log(
          `Successfully deleted ${deletedCount} old activity log entries (older than ${daysToKeep} days)`
        );
      } else {
        this.logger.log("No old activity logs to delete");
      }
    } catch (error) {
      this.logger.error("Error during activity log cleanup:", error);
    }
  }

  /**
   * Ручная очистка старых логов (для вызова из API или админки)
   * @param daysToKeep Количество дней для хранения (по умолчанию 30)
   */
  async manualCleanup(daysToKeep: number = 30): Promise<number> {
    this.logger.log(
      `Starting manual cleanup of activity logs older than ${daysToKeep} days...`
    );

    try {
      const deletedCount = await this.activityLogService.cleanup(daysToKeep);
      this.logger.log(
        `Manual cleanup completed. Deleted ${deletedCount} entries`
      );
      return deletedCount;
    } catch (error) {
      this.logger.error("Error during manual activity log cleanup:", error);
      throw error;
    }
  }
}

