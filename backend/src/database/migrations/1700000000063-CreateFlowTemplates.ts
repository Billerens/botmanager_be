import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFlowTemplates1700000000063 implements MigrationInterface {
  name = "CreateFlowTemplates1700000000063";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum для типа темплейта
    await queryRunner.query(`
      CREATE TYPE "flow_template_type_enum" AS ENUM ('full', 'partial')
    `);

    // Enum для статуса темплейта
    await queryRunner.query(`
      CREATE TYPE "flow_template_status_enum" AS ENUM (
        'draft', 'private', 'pending_review', 'published',
        'rejected', 'pending_deletion', 'archived'
      )
    `);

    // Таблица категорий
    await queryRunner.query(`
      CREATE TABLE "flow_template_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" varchar(64) NOT NULL,
        "name" jsonb NOT NULL,
        "description" jsonb,
        "icon" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_flow_template_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_flow_template_categories" PRIMARY KEY ("id")
      )
    `);

    // Таблица темплейтов
    await queryRunner.query(`
      CREATE TABLE "flow_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(128) NOT NULL,
        "description" text,
        "type" "flow_template_type_enum" NOT NULL,
        "categoryId" uuid,
        "tags" text[] NOT NULL DEFAULT '{}',
        "flowData" jsonb NOT NULL,
        "status" "flow_template_status_enum" NOT NULL DEFAULT 'draft',
        "isPlatformChoice" boolean NOT NULL DEFAULT false,
        "rejectionReason" varchar,
        "deletionRequestReason" text,
        "authorId" uuid,
        "usageCount" integer NOT NULL DEFAULT 0,
        "nodeCount" integer NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "publishedAt" TIMESTAMP,
        "archivedAt" TIMESTAMP,
        CONSTRAINT "PK_flow_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_flow_templates_categoryId" FOREIGN KEY ("categoryId")
          REFERENCES "flow_template_categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_flow_templates_authorId" FOREIGN KEY ("authorId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_status" ON "flow_templates" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_type" ON "flow_templates" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_authorId" ON "flow_templates" ("authorId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_categoryId" ON "flow_templates" ("categoryId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_isPlatformChoice" ON "flow_templates" ("isPlatformChoice")
    `);
    // GIN-индекс для быстрого поиска по тегам
    await queryRunner.query(`
      CREATE INDEX "IDX_flow_templates_tags" ON "flow_templates" USING GIN ("tags")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_tags"`);
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_isPlatformChoice"`);
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_categoryId"`);
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_authorId"`);
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_type"`);
    await queryRunner.query(`DROP INDEX "IDX_flow_templates_status"`);
    await queryRunner.query(`DROP TABLE "flow_templates"`);
    await queryRunner.query(`DROP TABLE "flow_template_categories"`);
    await queryRunner.query(`DROP TYPE "flow_template_status_enum"`);
    await queryRunner.query(`DROP TYPE "flow_template_type_enum"`);
  }
}
