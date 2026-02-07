import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowedForBotFlowModelIds1700000000061
  implements MigrationInterface
{
  name = "AddAllowedForBotFlowModelIds1700000000061";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "openrouter_agent_settings"
      ADD COLUMN "allowedForBotFlowModelIds" text NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "openrouter_agent_settings"
      DROP COLUMN "allowedForBotFlowModelIds"
    `);
  }
}
