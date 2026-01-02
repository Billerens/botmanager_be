import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Миграция для удаления deprecated полей бронирования из таблицы bots
 * и удаления botId из таблицы specialists.
 *
 * Эти поля были перенесены в отдельную сущность BookingSystem.
 */
export class RemoveDeprecatedBookingFieldsFromBots1700000000043
  implements MigrationInterface
{
  name = "RemoveDeprecatedBookingFieldsFromBots1700000000043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =================================================================
    // 1. Удаляем deprecated поля из таблицы bots
    // =================================================================

    // Удаляем unique constraint с slug если есть
    await queryRunner.query(`
      ALTER TABLE "bots" DROP CONSTRAINT IF EXISTS "UQ_bots_slug"
    `);

    // Удаляем индекс если есть
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_bots_slug"
    `);

    // Удаляем поля субдомена бронирования
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "slug",
      DROP COLUMN IF EXISTS "subdomainStatus",
      DROP COLUMN IF EXISTS "subdomainError",
      DROP COLUMN IF EXISTS "subdomainActivatedAt",
      DROP COLUMN IF EXISTS "subdomainUrl"
    `);

    // Удаляем поля системы бронирования
    await queryRunner.query(`
      ALTER TABLE "bots"
      DROP COLUMN IF EXISTS "isBookingEnabled",
      DROP COLUMN IF EXISTS "bookingTitle",
      DROP COLUMN IF EXISTS "bookingDescription",
      DROP COLUMN IF EXISTS "bookingLogoUrl",
      DROP COLUMN IF EXISTS "bookingCustomStyles",
      DROP COLUMN IF EXISTS "bookingButtonTypes",
      DROP COLUMN IF EXISTS "bookingButtonSettings",
      DROP COLUMN IF EXISTS "bookingSettings",
      DROP COLUMN IF EXISTS "bookingBrowserAccessEnabled"
    `);

    // =================================================================
    // 2. Удаляем deprecated поле botId из таблицы specialists
    // =================================================================

    // Удаляем foreign key constraint если есть
    await queryRunner.query(`
      ALTER TABLE "specialists" DROP CONSTRAINT IF EXISTS "FK_specialists_botId"
    `);

    // Удаляем индекс если есть
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_specialists_botId"
    `);

    // Удаляем столбец botId
    await queryRunner.query(`
      ALTER TABLE "specialists" DROP COLUMN IF EXISTS "botId"
    `);

    // Делаем bookingSystemId обязательным (NOT NULL)
    // Сначала проверяем, есть ли записи с NULL
    const nullRecords = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "specialists" WHERE "bookingSystemId" IS NULL
    `);

    if (parseInt(nullRecords[0].count) === 0) {
      // Если нет записей с NULL, делаем поле обязательным
      await queryRunner.query(`
        ALTER TABLE "specialists" ALTER COLUMN "bookingSystemId" SET NOT NULL
      `);
    } else {
      console.warn(
        `Warning: Found ${nullRecords[0].count} specialists with NULL bookingSystemId. ` +
          `Cannot set NOT NULL constraint. Please migrate these records first.`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =================================================================
    // 1. Восстанавливаем поле botId в таблице specialists
    // =================================================================

    // Делаем bookingSystemId nullable снова
    await queryRunner.query(`
      ALTER TABLE "specialists" ALTER COLUMN "bookingSystemId" DROP NOT NULL
    `);

    // Добавляем столбец botId
    await queryRunner.query(`
      ALTER TABLE "specialists" ADD COLUMN IF NOT EXISTS "botId" uuid
    `);

    // Создаем индекс
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_specialists_botId" ON "specialists" ("botId")
    `);

    // Создаем foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "specialists" 
      ADD CONSTRAINT "FK_specialists_botId" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // =================================================================
    // 2. Восстанавливаем deprecated поля в таблице bots
    // =================================================================

    // Восстанавливаем поля системы бронирования
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "isBookingEnabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "bookingTitle" varchar,
      ADD COLUMN IF NOT EXISTS "bookingDescription" text,
      ADD COLUMN IF NOT EXISTS "bookingLogoUrl" varchar,
      ADD COLUMN IF NOT EXISTS "bookingCustomStyles" text,
      ADD COLUMN IF NOT EXISTS "bookingButtonTypes" json,
      ADD COLUMN IF NOT EXISTS "bookingButtonSettings" json,
      ADD COLUMN IF NOT EXISTS "bookingSettings" json,
      ADD COLUMN IF NOT EXISTS "bookingBrowserAccessEnabled" boolean DEFAULT false
    `);

    // Восстанавливаем поля субдомена
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "slug" varchar,
      ADD COLUMN IF NOT EXISTS "subdomainStatus" varchar,
      ADD COLUMN IF NOT EXISTS "subdomainError" varchar,
      ADD COLUMN IF NOT EXISTS "subdomainActivatedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "subdomainUrl" varchar
    `);

    // Создаем unique constraint для slug
    await queryRunner.query(`
      ALTER TABLE "bots" ADD CONSTRAINT "UQ_bots_slug" UNIQUE ("slug")
    `);
  }
}
