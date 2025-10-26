import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddImageUrlToServices1700000000011
  implements MigrationInterface
{
  name = "AddImageUrlToServices1700000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле imageUrl в таблицу services
    await queryRunner.addColumn(
      "services",
      new TableColumn({
        name: "imageUrl",
        type: "varchar",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем поле imageUrl из таблицы services
    await queryRunner.dropColumn("services", "imageUrl");
  }
}

