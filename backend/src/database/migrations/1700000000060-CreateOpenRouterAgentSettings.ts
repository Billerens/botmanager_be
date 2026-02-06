import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOpenRouterAgentSettings1700000000060
  implements MigrationInterface
{
  name = "CreateOpenRouterAgentSettings1700000000060";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "openrouter_agent_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disabledModelIds" text NOT NULL DEFAULT '',
        "maxCostPerMillion" decimal(10,6) NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_openrouter_agent_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "openrouter_agent_settings" ("id", "disabledModelIds", "maxCostPerMillion")
      VALUES (uuid_generate_v4(), '', NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "openrouter_agent_settings"`);
  }
}
