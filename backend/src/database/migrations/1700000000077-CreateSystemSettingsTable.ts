import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemSettingsTable1700000000077
  implements MigrationInterface
{
  name = "CreateSystemSettingsTable1700000000077";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "system_settings" (
                "key" character varying(100) NOT NULL,
                "value" jsonb,
                "description" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_system_settings_key" PRIMARY KEY ("key")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_settings"`);
  }
}
