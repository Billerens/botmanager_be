import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicApiKeysAndAccessSettings1700000000052 implements MigrationInterface {
  name = "AddPublicApiKeysAndAccessSettings1700000000052";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // 1. Создаём таблицу public_api_keys
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "public_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "name" character varying NOT NULL,
        "ownerId" character varying NOT NULL,
        "ownerType" character varying NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "isTestMode" boolean NOT NULL DEFAULT false,
        "allowedDomains" jsonb NOT NULL DEFAULT '[]',
        "allowedIps" jsonb NOT NULL DEFAULT '[]',
        "rateLimit" integer NOT NULL DEFAULT 60,
        "expiresAt" TIMESTAMP,
        "lastUsedAt" TIMESTAMP,
        "usageCount" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_public_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_public_api_keys_key" UNIQUE ("key")
      )
    `);

    // Индексы для public_api_keys
    await queryRunner.query(`
      CREATE INDEX "IDX_public_api_keys_ownerId_ownerType" 
      ON "public_api_keys" ("ownerId", "ownerType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_public_api_keys_key" 
      ON "public_api_keys" ("key")
    `);

    // ========================================================================
    // 2. Добавляем поля accessSettings и rowLevelSecurity в custom_collection_schemas
    // ========================================================================
    
    // Значения по умолчанию
    const defaultAccessSettings = JSON.stringify({
      public: { read: false, list: false },
      authenticated: { read: true, list: true, create: false, update: false, delete: false }
    });

    const defaultRlsRules = JSON.stringify({
      read: "true",
      create: "true",
      update: "data.createdBy = @userId",
      delete: "data.createdBy = @userId"
    });

    // Проверяем, существуют ли уже колонки
    const accessSettingsExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'custom_collection_schemas' AND column_name = 'accessSettings'
    `);

    if (accessSettingsExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "custom_collection_schemas" 
        ADD COLUMN "accessSettings" jsonb NOT NULL DEFAULT '${defaultAccessSettings}'::jsonb
      `);
    }

    const rlsExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'custom_collection_schemas' AND column_name = 'rowLevelSecurity'
    `);

    if (rlsExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "custom_collection_schemas" 
        ADD COLUMN "rowLevelSecurity" jsonb NOT NULL DEFAULT '${defaultRlsRules}'::jsonb
      `);
    }

    // ========================================================================
    // 3. Обновляем существующие записи (если они есть)
    // ========================================================================
    await queryRunner.query(`
      UPDATE "custom_collection_schemas" 
      SET "accessSettings" = '${defaultAccessSettings}'::jsonb
      WHERE "accessSettings" IS NULL OR "accessSettings" = '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "custom_collection_schemas" 
      SET "rowLevelSecurity" = '${defaultRlsRules}'::jsonb
      WHERE "rowLevelSecurity" IS NULL OR "rowLevelSecurity" = '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем таблицу public_api_keys
    await queryRunner.query(`DROP TABLE IF EXISTS "public_api_keys"`);

    // Удаляем колонки из custom_collection_schemas
    await queryRunner.query(`
      ALTER TABLE "custom_collection_schemas" 
      DROP COLUMN IF EXISTS "accessSettings"
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_collection_schemas" 
      DROP COLUMN IF EXISTS "rowLevelSecurity"
    `);
  }
}
