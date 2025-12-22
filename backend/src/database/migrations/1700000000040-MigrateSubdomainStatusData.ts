import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Конвертирует старые значения статусов субдоменов в новые:
 * - ssl_issuing → activating
 * - dns_error, ssl_error → error
 */
export class MigrateSubdomainStatusData1700000000040
  implements MigrationInterface
{
  name = "MigrateSubdomainStatusData1700000000040";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ssl_issuing → activating
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

    // dns_error, ssl_error → error
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
    // activating → ssl_issuing
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

    // error → dns_error
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

