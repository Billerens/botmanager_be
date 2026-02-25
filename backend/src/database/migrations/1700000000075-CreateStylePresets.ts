import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStylePresets1700000000075 implements MigrationInterface {
  name = "CreateStylePresets1700000000075";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum для целевой сущности
    await queryRunner.query(`
      CREATE TYPE "style_preset_target_enum" AS ENUM ('shop', 'booking')
    `);

    // Enum для статуса пресета
    await queryRunner.query(`
      CREATE TYPE "style_preset_status_enum" AS ENUM (
        'draft', 'private', 'pending_review', 'published',
        'rejected', 'pending_deletion', 'archived'
      )
    `);

    // Таблица пресетов стилей
    await queryRunner.query(`
      CREATE TABLE "style_presets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(128) NOT NULL,
        "description" text,
        "target" "style_preset_target_enum" NOT NULL,
        "tags" text[] NOT NULL DEFAULT '{}',
        "cssData" text NOT NULL,
        "status" "style_preset_status_enum" NOT NULL DEFAULT 'draft',
        "isPlatformChoice" boolean NOT NULL DEFAULT false,
        "rejectionReason" varchar,
        "deletionRequestReason" text,
        "authorId" uuid,
        "usageCount" integer NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "publishedAt" TIMESTAMP,
        "archivedAt" TIMESTAMP,
        CONSTRAINT "PK_style_presets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_style_presets_authorId" FOREIGN KEY ("authorId")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_style_presets_status" ON "style_presets" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_style_presets_target" ON "style_presets" ("target")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_style_presets_authorId" ON "style_presets" ("authorId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_style_presets_isPlatformChoice" ON "style_presets" ("isPlatformChoice")
    `);
    // GIN-индекс для быстрого поиска по тегам
    await queryRunner.query(`
      CREATE INDEX "IDX_style_presets_tags" ON "style_presets" USING GIN ("tags")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_style_presets_tags"`);
    await queryRunner.query(`DROP INDEX "IDX_style_presets_isPlatformChoice"`);
    await queryRunner.query(`DROP INDEX "IDX_style_presets_authorId"`);
    await queryRunner.query(`DROP INDEX "IDX_style_presets_target"`);
    await queryRunner.query(`DROP INDEX "IDX_style_presets_status"`);
    await queryRunner.query(`DROP TABLE "style_presets"`);
    await queryRunner.query(`DROP TYPE "style_preset_status_enum"`);
    await queryRunner.query(`DROP TYPE "style_preset_target_enum"`);
  }
}
