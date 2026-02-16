import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveProductCurrency1700000000074 implements MigrationInterface {
  name = "RemoveProductCurrency1700000000074";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "currency"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "currency" character varying(3) NOT NULL DEFAULT 'RUB'`
    );
  }
}
