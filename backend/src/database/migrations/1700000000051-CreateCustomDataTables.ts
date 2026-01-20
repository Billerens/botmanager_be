import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomDataTables1700000000051 implements MigrationInterface {
  name = "CreateCustomDataTables1700000000051";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем enum для типа владельца
    await queryRunner.query(`
      CREATE TYPE "custom_data_owner_type_enum" AS ENUM (
        'bot', 
        'shop', 
        'booking', 
        'custom_page', 
        'custom_app'
      )
    `);

    // Создаем enum для типа поля
    await queryRunner.query(`
      CREATE TYPE "field_type_enum" AS ENUM (
        'string',
        'number',
        'boolean',
        'date',
        'array',
        'object',
        'text',
        'email',
        'url',
        'phone',
        'select',
        'multiselect',
        'file',
        'image',
        'relation'
      )
    `);

    // Создаем enum для типа связи
    await queryRunner.query(`
      CREATE TYPE "relation_type_enum" AS ENUM (
        'one-to-one',
        'one-to-many',
        'many-to-one'
      )
    `);

    // ========================================================================
    // ТАБЛИЦА СХЕМ КОЛЛЕКЦИЙ
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "custom_collection_schemas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "ownerType" "custom_data_owner_type_enum" NOT NULL,
        "collectionName" character varying NOT NULL,
        "displayName" character varying,
        "description" text,
        "icon" character varying,
        "schema" jsonb NOT NULL,
        "indexedFields" jsonb NOT NULL DEFAULT '[]',
        "titleField" character varying,
        "relations" jsonb,
        "uiSettings" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_collection_schemas" PRIMARY KEY ("id")
      )
    `);

    // Уникальный индекс для ownerId + ownerType + collectionName
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_collection_schemas_owner_collection" 
      ON "custom_collection_schemas" ("ownerId", "ownerType", "collectionName")
      WHERE "isDeleted" = false
    `);

    // Индекс для получения списка коллекций владельца
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_collection_schemas_owner" 
      ON "custom_collection_schemas" ("ownerId", "ownerType")
    `);

    // ========================================================================
    // ТАБЛИЦА ДАННЫХ
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "custom_data" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "ownerType" "custom_data_owner_type_enum" NOT NULL,
        "collection" character varying NOT NULL,
        "schemaId" uuid,
        "key" character varying NOT NULL,
        "data" jsonb NOT NULL,
        "indexedData" jsonb,
        "metadata" jsonb,
        "title" character varying,
        "version" integer NOT NULL DEFAULT 1,
        "sortOrder" integer,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_data" PRIMARY KEY ("id")
      )
    `);

    // Уникальный индекс для ownerId + ownerType + collection + key
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_custom_data_owner_collection_key" 
      ON "custom_data" ("ownerId", "ownerType", "collection", "key")
    `);

    // Индекс для получения списка записей коллекции
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_owner_collection" 
      ON "custom_data" ("ownerId", "ownerType", "collection")
    `);

    // Индекс для активных записей
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_owner_collection_active" 
      ON "custom_data" ("ownerId", "ownerType", "collection", "isDeleted")
    `);

    // GIN индекс для быстрого поиска по JSONB data
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_data_gin" 
      ON "custom_data" USING GIN ("data")
    `);

    // GIN индекс для быстрого поиска по indexedData
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_indexed_gin" 
      ON "custom_data" USING GIN ("indexedData")
    `);

    // Индекс для полнотекстового поиска по title
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_title" 
      ON "custom_data" ("title")
      WHERE "isDeleted" = false
    `);

    // Индекс для сортировки по дате создания
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_data_created_at" 
      ON "custom_data" ("ownerId", "ownerType", "collection", "createdAt" DESC)
      WHERE "isDeleted" = false
    `);

    // Внешний ключ на схему
    await queryRunner.query(`
      ALTER TABLE "custom_data"
      ADD CONSTRAINT "FK_custom_data_schema" 
      FOREIGN KEY ("schemaId") REFERENCES "custom_collection_schemas"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    await queryRunner.query(`ALTER TABLE "custom_data" DROP CONSTRAINT IF EXISTS "FK_custom_data_schema"`);

    // Удаляем индексы таблицы данных
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_title"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_indexed_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_data_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_owner_collection_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_owner_collection"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_data_owner_collection_key"`);

    // Удаляем таблицу данных
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_data"`);

    // Удаляем индексы таблицы схем
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_collection_schemas_owner"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_custom_collection_schemas_owner_collection"`);

    // Удаляем таблицу схем
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_collection_schemas"`);

    // Удаляем enum типы
    await queryRunner.query(`DROP TYPE IF EXISTS "relation_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "field_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "custom_data_owner_type_enum"`);
  }
}
