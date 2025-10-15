import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class RemoveShopButtonFields1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("bots", ["shopButtonText", "shopButtonColor"]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("bots", [
      new TableColumn({
        name: "shopButtonText",
        type: "varchar",
        isNullable: true,
      }),
      new TableColumn({
        name: "shopButtonColor",
        type: "varchar",
        isNullable: true,
      }),
    ]);
  }
}
