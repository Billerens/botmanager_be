import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomDomainsTable1700000000035
  implements MigrationInterface
{
  name = "CreateCustomDomainsTable1700000000035";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum типы
    await queryRunner.query(`
      CREATE TYPE "domain_status_enum" AS ENUM (
        'pending',
        'awaiting_dns',
        'validating_dns',
        'dns_invalid',
        'awaiting_verification',
        'validating_ownership',
        'issuing_ssl',
        'active',
        'ssl_error',
        'ssl_expiring',
        'suspended'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "domain_target_type_enum" AS ENUM (
        'shop',
        'booking',
        'custom_page'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "verification_method_enum" AS ENUM (
        'dns_txt',
        'http_file'
      )
    `);

    // Создаём таблицу custom_domains
    await queryRunner.query(`
      CREATE TABLE "custom_domains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "domain" character varying NOT NULL,
        "status" "domain_status_enum" NOT NULL DEFAULT 'pending',
        "targetType" "domain_target_type_enum" NOT NULL,
        "shopId" character varying,
        "bookingId" character varying,
        "customPageId" character varying,
        "verificationToken" character varying NOT NULL,
        "isVerified" boolean NOT NULL DEFAULT false,
        "verificationMethod" "verification_method_enum",
        "expectedCname" character varying NOT NULL DEFAULT 'proxy.botmanager.io',
        "lastDnsCheck" jsonb,
        "dnsCheckAttempts" integer NOT NULL DEFAULT 0,
        "sslIssuedAt" TIMESTAMP,
        "sslExpiresAt" TIMESTAMP,
        "sslIssuer" character varying,
        "lastSslCheck" jsonb,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "warnings" jsonb NOT NULL DEFAULT '[]',
        "nextAllowedCheck" TIMESTAMP,
        "consecutiveFailures" integer NOT NULL DEFAULT 0,
        "suspendedAt" TIMESTAMP,
        "suspendReason" character varying,
        "notificationsSent" jsonb NOT NULL DEFAULT '[]',
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_custom_domains_domain" UNIQUE ("domain"),
        CONSTRAINT "PK_custom_domains" PRIMARY KEY ("id")
      )
    `);

    // Создаём индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_domains_domain" ON "custom_domains" ("domain")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_domains_userId" ON "custom_domains" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_domains_status" ON "custom_domains" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_domains_userId_status" ON "custom_domains" ("userId", "status")
    `);

    // Добавляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "custom_domains" 
      ADD CONSTRAINT "FK_custom_domains_user" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "custom_domains" DROP CONSTRAINT "FK_custom_domains_user"
    `);

    // Удаляем индексы
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_domains_userId_status"`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_domains_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_domains_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_domains_domain"`);

    // Удаляем таблицу
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_domains"`);

    // Удаляем enum типы
    await queryRunner.query(`DROP TYPE IF EXISTS "verification_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "domain_target_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "domain_status_enum"`);
  }
}

