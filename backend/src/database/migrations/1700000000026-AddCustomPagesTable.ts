import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class AddCustomPagesTable1700000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу custom_pages
    await queryRunner.createTable(
      new Table({
        name: "custom_pages",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "title",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "slug",
            type: "varchar",
            isNullable: false,
            isUnique: true,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "content",
            type: "text",
            isNullable: false,
          },
          {
            name: "status",
            type: "enum",
            enum: ["active", "inactive"],
            default: "'active'",
          },
          {
            name: "isWebAppOnly",
            type: "boolean",
            default: false,
          },
          {
            name: "botCommand",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "botId",
            type: "uuid",
            isNullable: false,
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

    // Создаем индексы для оптимизации запросов
    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_BOT_STATUS",
        columnNames: ["botId", "status"],
      })
    );

    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_SLUG",
        columnNames: ["slug"],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_BOT_COMMAND",
        columnNames: ["botId", "botCommand"],
      })
    );

    // Создаем внешний ключ на таблицу bots
    await queryRunner.createForeignKey(
      "custom_pages",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем таблицу (foreign keys удалятся автоматически)
    await queryRunner.dropTable("custom_pages", true);
  }
}
