import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOpenRouterFeaturedModels1700000000059
  implements MigrationInterface
{
  name = "CreateOpenRouterFeaturedModels1700000000059";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "openrouter_featured_models" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "modelId" character varying NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_openrouter_featured_models_modelId" UNIQUE ("modelId"),
        CONSTRAINT "PK_openrouter_featured_models" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_openrouter_featured_models_sortOrder"
      ON "openrouter_featured_models" ("sortOrder")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_openrouter_featured_models_sortOrder"`
    );
    await queryRunner.query(`DROP TABLE "openrouter_featured_models"`);
  }
}
