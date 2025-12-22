import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Конвертирует старые значения статусов субдоменов в новые:
 * - ssl_issuing → activating
 * - dns_error, ssl_error → error
 *
 * ВАЖНО: Миграция безопасна для баз данных, где старые значения enum
 * уже не существуют (использует CAST к TEXT для сравнения).
 */
export class MigrateSubdomainStatusData1700000000040
  implements MigrationInterface
{
  name = "MigrateSubdomainStatusData1700000000040";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, есть ли старые значения в enum перед обновлением
    // Используем CAST к TEXT для безопасного сравнения

    // ssl_issuing → activating (для shops_subdomainstatus_enum)
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus"::text = 'ssl_issuing'
    `);

    // ssl_issuing → activating (для subdomain_status_enum - bots)
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus"::text = 'ssl_issuing'
    `);

    // ssl_issuing → activating (для custom_pages)
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'activating' 
      WHERE "subdomainStatus"::text = 'ssl_issuing'
    `);

    // dns_error, ssl_error → error
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus"::text IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus"::text IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'error' 
      WHERE "subdomainStatus"::text IN ('dns_error', 'ssl_error')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // activating → ssl_issuing
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus"::text = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus"::text = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'ssl_issuing' 
      WHERE "subdomainStatus"::text = 'activating'
    `);

    // error → dns_error
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus"::text = 'error'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus"::text = 'error'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'dns_error' 
      WHERE "subdomainStatus"::text = 'error'
    `);
  }
}
