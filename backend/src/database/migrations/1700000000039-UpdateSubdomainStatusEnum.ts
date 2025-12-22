import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Миграция для обновления SubdomainStatus enum
 *
 * Добавляет новые значения: activating, error
 * Конвертирует старые значения в новые
 */
export class UpdateSubdomainStatusEnum1700000000039
  implements MigrationInterface
{
  name = "UpdateSubdomainStatusEnum1700000000039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем новые значения во ВСЕ enum'ы которые могут существовать
    // (TypeORM создаёт разные enum'ы для разных таблиц)

    // Для shops (shops_subdomainstatus_enum)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shops_subdomainstatus_enum') THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'activating' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shops_subdomainstatus_enum')
          ) THEN
            ALTER TYPE "shops_subdomainstatus_enum" ADD VALUE 'activating';
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'error' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shops_subdomainstatus_enum')
          ) THEN
            ALTER TYPE "shops_subdomainstatus_enum" ADD VALUE 'error';
          END IF;
        END IF;
      END$$;
    `);

    // Для subdomain_status_enum (общий, если есть)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subdomain_status_enum') THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'activating' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subdomain_status_enum')
          ) THEN
            ALTER TYPE "subdomain_status_enum" ADD VALUE 'activating';
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'error' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subdomain_status_enum')
          ) THEN
            ALTER TYPE "subdomain_status_enum" ADD VALUE 'error';
          END IF;
        END IF;
      END$$;
    `);

    // Обновляем данные: ssl_issuing → activating
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus" = 'ssl_issuing'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus" = 'ssl_issuing'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus" = 'ssl_issuing'
    `);

    // Обновляем данные: dns_error, ssl_error → error
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Обратная миграция
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus" = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus" = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus" = 'activating'
    `);

    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus" = 'error'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus" = 'error'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus" = 'error'
    `);
  }
}
