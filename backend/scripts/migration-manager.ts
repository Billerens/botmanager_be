#!/usr/bin/env node

/**
 * Скрипт для ручного управления миграциями
 * Использование:
 *   npm run migration:status  - показать статус миграций
 *   npm run migration:run     - применить миграции
 *   npm run migration:revert  - откатить последнюю миграцию
 */

import { AppDataSource } from "../src/database/data-source";
import { MigrationService } from "../src/database/migration.service";

async function main() {
  const command = process.argv[2];

  try {
    // Инициализируем подключение
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const migrationService = new MigrationService(AppDataSource);

    switch (command) {
      case "status":
        console.log("📊 Статус миграций:");
        await migrationService.checkDatabaseStatus();
        break;

      case "run":
        console.log("🚀 Применение миграций:");
        await migrationService.runMigrations();
        break;

      case "revert":
        console.log("⏪ Откат последней миграции:");
        await AppDataSource.undoLastMigration();
        console.log("✅ Миграция откачена");
        break;

      default:
        console.log("❌ Неизвестная команда. Доступные команды:");
        console.log("   status  - показать статус миграций");
        console.log("   run     - применить миграции");
        console.log("   revert  - откатить последнюю миграцию");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main();
