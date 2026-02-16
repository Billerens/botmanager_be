import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShopCurrency1700000000073 implements MigrationInterface {
  name = "AddShopCurrency1700000000073";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shops" ADD "currency" character varying(3) NOT NULL DEFAULT 'BYN'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "currency"`);
  }
}
