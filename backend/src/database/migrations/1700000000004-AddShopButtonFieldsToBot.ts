import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShopButtonFieldsToBot1700000000004
  implements MigrationInterface
{
  name = "AddShopButtonFieldsToBot1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN "shopButtonTypes" json,
      ADD COLUMN "shopButtonSettings" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN "shopButtonTypes",
      DROP COLUMN "shopButtonSettings"
    `);
  }
}
