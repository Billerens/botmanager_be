import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Добавляет новые значения в enum: activating, error
 *
 * ВАЖНО: PostgreSQL не позволяет использовать новые значения enum
 * в той же транзакции где они были добавлены.
 * Поэтому обновление данных вынесено в отдельную миграцию 40.
 */
export class UpdateSubdomainStatusEnum1700000000039
  implements MigrationInterface
{
  name = "UpdateSubdomainStatusEnum1700000000039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем новые значения в shops_subdomainstatus_enum
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

    // Добавляем новые значения в subdomain_status_enum
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не поддерживает удаление значений из enum
  }
}
