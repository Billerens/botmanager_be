import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreatePaymentConfigsTable1700000000045
  implements MigrationInterface
{
  name = "CreatePaymentConfigsTable1700000000045";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum для типа сущности
    await queryRunner.query(`
      CREATE TYPE "payment_entity_type_enum" AS ENUM (
        'shop',
        'booking_system',
        'custom_page',
        'bot'
      )
    `);

    // Создаём таблицу payment_configs
    await queryRunner.createTable(
      new Table({
        name: "payment_configs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "entityType",
            type: "payment_entity_type_enum",
          },
          {
            name: "entityId",
            type: "uuid",
          },
          {
            name: "ownerId",
            type: "uuid",
          },
          {
            name: "enabled",
            type: "boolean",
            default: false,
          },
          {
            name: "testMode",
            type: "boolean",
            default: true,
          },
          {
            name: "settings",
            type: "jsonb",
            default: "'{}'",
          },
          {
            name: "providers",
            type: "text",
            default: "''",
          },
          {
            name: "providerSettings",
            type: "jsonb",
            default: "'{}'",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        foreignKeys: [
          {
            columnNames: ["ownerId"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
        ],
      }),
      true
    );

    // Создаём уникальный индекс для entityType + entityId
    await queryRunner.createIndex(
      "payment_configs",
      new TableIndex({
        name: "IDX_payment_configs_entity_type_id",
        columnNames: ["entityType", "entityId"],
        isUnique: true,
      })
    );

    // Создаём индекс для ownerId
    await queryRunner.createIndex(
      "payment_configs",
      new TableIndex({
        name: "IDX_payment_configs_owner_id",
        columnNames: ["ownerId"],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.dropIndex(
      "payment_configs",
      "IDX_payment_configs_entity_type_id"
    );
    await queryRunner.dropIndex(
      "payment_configs",
      "IDX_payment_configs_owner_id"
    );

    // Удаляем таблицу
    await queryRunner.dropTable("payment_configs");

    // Удаляем enum
    await queryRunner.query(`DROP TYPE "payment_entity_type_enum"`);
  }
}

