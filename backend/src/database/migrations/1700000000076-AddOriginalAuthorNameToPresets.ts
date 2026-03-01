import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOriginalAuthorNameToPresets1700000000076 implements MigrationInterface {
  name = "AddOriginalAuthorNameToPresets1700000000076";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "style_presets" ADD "originalAuthorName" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "flow_templates" ADD "originalAuthorName" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flow_templates" DROP COLUMN "originalAuthorName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "style_presets" DROP COLUMN "originalAuthorName"`,
    );
  }
}
