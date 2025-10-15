import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShopFieldsToBot1700000000003 implements MigrationInterface {
  name = "AddShopFieldsToBot1700000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bots" ADD "isShop" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD "shopButtonText" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD "shopButtonColor" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD "shopLogoUrl" character varying`
    );
    await queryRunner.query(`ALTER TABLE "bots" ADD "shopCustomStyles" text`);
    await queryRunner.query(
      `ALTER TABLE "bots" ADD "shopTitle" character varying`
    );
    await queryRunner.query(`ALTER TABLE "bots" ADD "shopDescription" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "shopDescription"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "shopTitle"`);
    await queryRunner.query(
      `ALTER TABLE "bots" DROP COLUMN "shopCustomStyles"`
    );
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "shopLogoUrl"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "shopButtonColor"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "shopButtonText"`);
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "isShop"`);
  }
}
