import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Добавляет поля для управления субдоменами в таблицы bots и custom_pages.
 *
 * Субдомены используются для:
 * - {slug}.booking.{domain} → бронирование (Bot)
 * - {slug}.pages.{domain} → кастомные страницы (CustomPage)
 */
export class AddSubdomainFieldsToBotsAndPages1700000000038
  implements MigrationInterface
{
  name = "AddSubdomainFieldsToBotsAndPages1700000000038";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum если не существует (на случай если миграция 37 не создала его)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subdomain_status_enum') THEN
          CREATE TYPE "subdomain_status_enum" AS ENUM (
            'pending',
            'dns_creating',
            'activating',
            'active',
            'error',
            'removing'
          );
        END IF;
      END$$;
    `);

    // =====================================================
    // Добавляем поля субдомена в таблицу bots
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "subdomainStatus" "subdomain_status_enum" DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "subdomainError" VARCHAR DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "subdomainActivatedAt" TIMESTAMP DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "bots"
      ADD COLUMN IF NOT EXISTS "subdomainUrl" VARCHAR DEFAULT NULL
    `);

    // Создаём индекс для быстрого поиска по статусу
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bots_subdomain_status" ON "bots" ("subdomainStatus")
    `);

    // =====================================================
    // Добавляем поля субдомена в таблицу custom_pages
    // =====================================================
    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD COLUMN IF NOT EXISTS "subdomainStatus" "subdomain_status_enum" DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD COLUMN IF NOT EXISTS "subdomainError" VARCHAR DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD COLUMN IF NOT EXISTS "subdomainActivatedAt" TIMESTAMP DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD COLUMN IF NOT EXISTS "subdomainUrl" VARCHAR DEFAULT NULL
    `);

    // Создаём индекс для быстрого поиска по статусу
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_custom_pages_subdomain_status" ON "custom_pages" ("subdomainStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // Удаляем из custom_pages
    // =====================================================
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_pages_subdomain_status"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainUrl"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainActivatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainError"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainStatus"`
    );

    // =====================================================
    // Удаляем из bots
    // =====================================================
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bots_subdomain_status"`);
    await queryRunner.query(
      `ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainUrl"`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainActivatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainError"`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainStatus"`
    );
  }
}
