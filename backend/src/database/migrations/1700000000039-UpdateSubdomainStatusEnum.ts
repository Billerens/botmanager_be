import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Миграция для обновления SubdomainStatus enum
 *
 * Изменения:
 * - SSL_ISSUING → ACTIVATING (ждём DNS propagation + SSL от Timeweb)
 * - SSL_ERROR, DNS_ERROR → ERROR (объединяем в один статус)
 *
 * Архитектура:
 * - Backend создаёт A-записи в Timeweb DNS
 * - Timeweb автоматически выдаёт SSL сертификаты
 * - Frontend определяет по hostname что показывать
 */
export class UpdateSubdomainStatusEnum1700000000039
  implements MigrationInterface
{
  name = "UpdateSubdomainStatusEnum1700000000039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Добавляем новые значения в enum
    await queryRunner.query(`
      ALTER TYPE "subdomain_status_enum" ADD VALUE IF NOT EXISTS 'activating'
    `);
    await queryRunner.query(`
      ALTER TYPE "subdomain_status_enum" ADD VALUE IF NOT EXISTS 'error'
    `);

    // 2. Обновляем существующие записи
    // SSL_ISSUING → ACTIVATING
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'activating' WHERE "subdomainStatus" = 'ssl_issuing'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'activating' WHERE "subdomainStatus" = 'ssl_issuing'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'activating' WHERE "subdomainStatus" = 'ssl_issuing'
    `);

    // DNS_ERROR, SSL_ERROR → ERROR
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'error' WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'error' WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'error' WHERE "subdomainStatus" IN ('dns_error', 'ssl_error')
    `);

    // Примечание: В PostgreSQL нельзя удалить значения из enum без пересоздания типа.
    // Старые значения (ssl_issuing, dns_error, ssl_error) останутся в enum,
    // но не будут использоваться в коде.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Обратная миграция: ACTIVATING → SSL_ISSUING, ERROR → DNS_ERROR
    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'ssl_issuing' WHERE "subdomainStatus" = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'ssl_issuing' WHERE "subdomainStatus" = 'activating'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'ssl_issuing' WHERE "subdomainStatus" = 'activating'
    `);

    await queryRunner.query(`
      UPDATE "shops" SET "subdomainStatus" = 'dns_error' WHERE "subdomainStatus" = 'error'
    `);
    await queryRunner.query(`
      UPDATE "bots" SET "subdomainStatus" = 'dns_error' WHERE "subdomainStatus" = 'error'
    `);
    await queryRunner.query(`
      UPDATE "custom_pages" SET "subdomainStatus" = 'dns_error' WHERE "subdomainStatus" = 'error'
    `);
  }
}

