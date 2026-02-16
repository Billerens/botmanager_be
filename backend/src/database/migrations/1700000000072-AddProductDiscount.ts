import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductDiscount1700000000072 implements MigrationInterface {
  name = "AddProductDiscount1700000000072";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "discount" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "discount"`);
  }
}
