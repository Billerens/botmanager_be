import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreatePaymentsTable1700000000046 implements MigrationInterface {
  name = "CreatePaymentsTable1700000000046";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum для типа цели платежа
    await queryRunner.query(`
      CREATE TYPE "payment_target_type_enum" AS ENUM (
        'order',
        'booking',
        'api_call',
        'flow_payment',
        'custom'
      )
    `);

    // Создаём enum для статуса платежа
    await queryRunner.query(`
      CREATE TYPE "payment_status_enum" AS ENUM (
        'pending',
        'waiting_for_capture',
        'succeeded',
        'canceled',
        'refunded',
        'partially_refunded',
        'failed'
      )
    `);

    // Создаём таблицу payments
    await queryRunner.createTable(
      new Table({
        name: "payments",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          // Связь с источником
          {
            name: "entityType",
            type: "payment_entity_type_enum",
          },
          {
            name: "entityId",
            type: "uuid",
          },
          // Связь с целью
          {
            name: "targetType",
            type: "payment_target_type_enum",
            isNullable: true,
          },
          {
            name: "targetId",
            type: "uuid",
            isNullable: true,
          },
          // Владелец
          {
            name: "ownerId",
            type: "uuid",
          },
          // Платёжная информация
          {
            name: "provider",
            type: "varchar",
          },
          {
            name: "externalId",
            type: "varchar",
            isUnique: true,
          },
          {
            name: "status",
            type: "payment_status_enum",
            default: "'pending'",
          },
          {
            name: "amount",
            type: "decimal",
            precision: 12,
            scale: 2,
          },
          {
            name: "currency",
            type: "varchar",
            length: "3",
          },
          {
            name: "paymentUrl",
            type: "text",
            isNullable: true,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "customerData",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          // История
          {
            name: "statusHistory",
            type: "jsonb",
            default: "'[]'",
          },
          {
            name: "refunds",
            type: "jsonb",
            default: "'[]'",
          },
          {
            name: "refundedAmount",
            type: "decimal",
            precision: 12,
            scale: 2,
            default: 0,
          },
          // Временные метки
          {
            name: "paidAt",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "canceledAt",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "expiresAt",
            type: "timestamptz",
            isNullable: true,
          },
          // Ошибки
          {
            name: "errorMessage",
            type: "text",
            isNullable: true,
          },
          {
            name: "errorCode",
            type: "varchar",
            isNullable: true,
          },
          // Системные поля
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

    // Создаём индексы
    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_entity_type_id",
        columnNames: ["entityType", "entityId"],
      })
    );

    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_target_type_id",
        columnNames: ["targetType", "targetId"],
      })
    );

    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_external_id",
        columnNames: ["externalId"],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_status",
        columnNames: ["status"],
      })
    );

    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_created_at",
        columnNames: ["createdAt"],
      })
    );

    await queryRunner.createIndex(
      "payments",
      new TableIndex({
        name: "IDX_payments_owner_id",
        columnNames: ["ownerId"],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.dropIndex("payments", "IDX_payments_entity_type_id");
    await queryRunner.dropIndex("payments", "IDX_payments_target_type_id");
    await queryRunner.dropIndex("payments", "IDX_payments_external_id");
    await queryRunner.dropIndex("payments", "IDX_payments_status");
    await queryRunner.dropIndex("payments", "IDX_payments_created_at");
    await queryRunner.dropIndex("payments", "IDX_payments_owner_id");

    // Удаляем таблицу
    await queryRunner.dropTable("payments");

    // Удаляем enum'ы
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_target_type_enum"`);
  }
}

