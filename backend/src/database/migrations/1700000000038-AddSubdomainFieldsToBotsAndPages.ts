import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Добавляет поля для управления субдоменами в таблицы bots и custom_pages.
 * 
 * Субдомены используются для:
 * - {slug}.booking.{domain} → бронирование (Bot)
 * - {slug}.pages.{domain} → кастомные страницы (CustomPage)
 * 
 * Enum subdomain_status_enum уже создан в миграции 1700000000037,
 * но нужно добавить недостающие значения (deleting, deleted).
 */
export class AddSubdomainFieldsToBotsAndPages1700000000038
  implements MigrationInterface
{
  name = "AddSubdomainFieldsToBotsAndPages1700000000038";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем недостающие значения в enum (если ещё не существуют)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'deleting' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subdomain_status_enum')
        ) THEN
          ALTER TYPE "subdomain_status_enum" ADD VALUE 'deleting';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'deleted' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subdomain_status_enum')
        ) THEN
          ALTER TYPE "subdomain_status_enum" ADD VALUE 'deleted';
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
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_pages_subdomain_status"`);
    await queryRunner.query(`ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainUrl"`);
    await queryRunner.query(`ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainActivatedAt"`);
    await queryRunner.query(`ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainError"`);
    await queryRunner.query(`ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "subdomainStatus"`);

    // =====================================================
    // Удаляем из bots
    // =====================================================
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bots_subdomain_status"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainUrl"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainActivatedAt"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainError"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN IF EXISTS "subdomainStatus"`);

    // Примечание: не удаляем значения из enum, т.к. PostgreSQL не поддерживает
    // удаление значений из enum без пересоздания типа
  }
}

