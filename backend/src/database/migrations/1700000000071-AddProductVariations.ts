import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductVariations1700000000071 implements MigrationInterface {
  name = "AddProductVariations1700000000071";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "variations" json,
      ADD COLUMN "allowBaseOption" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "variations",
      DROP COLUMN "allowBaseOption"
    `);
  }
}
