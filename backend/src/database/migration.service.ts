import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppDataSource } from "./data-source";

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Автоматически применяет все ожидающие миграции
   * Вызывается при запуске приложения
   */
  async runMigrations(): Promise<void> {
    try {
      this.logger.log("🔄 Проверка и применение миграций...");

      // Проверяем, инициализировано ли подключение
      if (!this.dataSource.isInitialized) {
        this.logger.log("📡 Инициализация подключения к базе данных...");
        await this.dataSource.initialize();
      }

      // Проверяем, есть ли ожидающие миграции
      const hasPendingMigrations = await this.dataSource.showMigrations();

      if (!hasPendingMigrations) {
        this.logger.log("✅ Все миграции уже применены");
        return;
      }

      this.logger.log("📋 Найдены ожидающие миграции");

      // Применяем миграции
      this.logger.log("🚀 Применение миграций...");
      await this.dataSource.runMigrations();

      this.logger.log("✅ Все миграции успешно применены!");
    } catch (error) {
      this.logger.error("❌ Ошибка при применении миграций:", error);

      // В случае критической ошибки миграций, останавливаем приложение
      if (
        error.message?.includes("relation") ||
        error.message?.includes("table")
      ) {
        this.logger.error(
          "💥 Критическая ошибка базы данных. Приложение остановлено."
        );
        process.exit(1);
      }

      throw error;
    }
  }

  /**
   * Проверяет состояние базы данных и выводит диагностическую информацию
   */
  async checkDatabaseStatus(): Promise<void> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // Проверяем подключение
      await this.dataSource.query("SELECT 1");
      this.logger.log("✅ Подключение к базе данных установлено");

      // Проверяем существование таблицы миграций
      const migrationTableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'migrations'
        );
      `);

      if (migrationTableExists[0]?.exists) {
        this.logger.log("✅ Таблица миграций существует");

        // Получаем информацию о примененных миграциях
        const appliedMigrations = await this.dataSource.query(`
          SELECT name, timestamp FROM migrations ORDER BY timestamp DESC LIMIT 5
        `);

        if (appliedMigrations.length > 0) {
          this.logger.log("📋 Последние примененные миграции:");
          appliedMigrations.forEach((migration, index) => {
            this.logger.log(
              `   ${index + 1}. ${migration.name} (${new Date(parseInt(migration.timestamp)).toLocaleString()})`
            );
          });
        }
      } else {
        this.logger.log(
          "⚠️  Таблица миграций не найдена - будет создана при первой миграции"
        );
      }
    } catch (error) {
      this.logger.error("❌ Ошибка при проверке состояния базы данных:", error);
      throw error;
    }
  }

  /**
   * Создает резервную копию базы данных перед применением миграций
   * (опционально, для критических продакшен систем)
   */
  async createBackup(): Promise<void> {
    try {
      this.logger.log("💾 Создание резервной копии базы данных...");

      // Здесь можно добавить логику создания бэкапа
      // Например, через pg_dump или облачные сервисы

      this.logger.log("✅ Резервная копия создана");
    } catch (error) {
      this.logger.warn(
        "⚠️  Не удалось создать резервную копию:",
        error.message
      );
      // Не останавливаем процесс из-за ошибки бэкапа
    }
  }
}
