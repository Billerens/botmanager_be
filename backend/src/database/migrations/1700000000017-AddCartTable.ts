import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class AddCartTable1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "carts",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "botId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "telegramUsername",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "items",
            type: "json",
            default: "'[]'",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
      true
    );

    // Создаем уникальный индекс для botId + telegramUsername
    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_botId_telegramUsername",
        columnNames: ["botId", "telegramUsername"],
        isUnique: true,
      })
    );

    // Создаем внешний ключ для botId
    await queryRunner.createForeignKey(
      "carts",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("carts");
  }
}

