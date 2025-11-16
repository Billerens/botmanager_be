import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class AddGroupSessionsTable1700000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу group_sessions
    await queryRunner.createTable(
      new Table({
        name: "group_sessions",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "botId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "flowId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "currentNodeId",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "sharedVariables",
            type: "jsonb",
            default: "'{}'",
          },
          {
            name: "participantIds",
            type: "text",
            isNullable: false,
            default: "''",
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["active", "completed", "archived"],
            default: "'active'",
          },
          {
            name: "startedAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "completedAt",
            type: "timestamp",
            isNullable: true,
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
      "group_sessions",
      new TableIndex({
        name: "IDX_GROUP_SESSIONS_BOT_STATUS",
        columnNames: ["botId", "status"],
      })
    );

    await queryRunner.createIndex(
      "group_sessions",
      new TableIndex({
        name: "IDX_GROUP_SESSIONS_FLOW",
        columnNames: ["flowId"],
      })
    );

    await queryRunner.createIndex(
      "group_sessions",
      new TableIndex({
        name: "IDX_GROUP_SESSIONS_STATUS_UPDATED",
        columnNames: ["status", "updatedAt"],
      })
    );

    // Создаем внешние ключи
    await queryRunner.createForeignKey(
      "group_sessions",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "group_sessions",
      new TableForeignKey({
        columnNames: ["flowId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bot_flows",
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем таблицу (foreign keys удалятся автоматически)
    await queryRunner.dropTable("group_sessions", true);
  }
}

