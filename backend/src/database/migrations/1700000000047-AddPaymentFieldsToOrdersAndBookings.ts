import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from "typeorm";

export class AddPaymentFieldsToOrdersAndBookings1700000000047
  implements MigrationInterface
{
  name = "AddPaymentFieldsToOrdersAndBookings1700000000047";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum для статуса оплаты сущностей
    await queryRunner.query(`
      CREATE TYPE "entity_payment_status_enum" AS ENUM (
        'not_required',
        'pending',
        'paid',
        'failed',
        'refunded',
        'partially_refunded'
      )
    `);

    // ============================================
    // Добавляем поля в таблицу orders
    // ============================================

    await queryRunner.addColumns("orders", [
      new TableColumn({
        name: "paymentId",
        type: "uuid",
        isNullable: true,
      }),
      new TableColumn({
        name: "paymentStatus",
        type: "entity_payment_status_enum",
        default: "'not_required'",
      }),
      new TableColumn({
        name: "paymentRequired",
        type: "boolean",
        default: false,
      }),
      new TableColumn({
        name: "paymentAmount",
        type: "decimal",
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
    ]);

    // Foreign key для orders.paymentId
    await queryRunner.createForeignKey(
      "orders",
      new TableForeignKey({
        name: "FK_orders_payment_id",
        columnNames: ["paymentId"],
        referencedTableName: "payments",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );

    // ============================================
    // Добавляем поля в таблицу bookings
    // ============================================

    await queryRunner.addColumns("bookings", [
      new TableColumn({
        name: "paymentId",
        type: "uuid",
        isNullable: true,
      }),
      new TableColumn({
        name: "paymentStatus",
        type: "entity_payment_status_enum",
        default: "'not_required'",
      }),
      new TableColumn({
        name: "paymentRequired",
        type: "boolean",
        default: false,
      }),
      new TableColumn({
        name: "paymentAmount",
        type: "decimal",
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
    ]);

    // Foreign key для bookings.paymentId
    await queryRunner.createForeignKey(
      "bookings",
      new TableForeignKey({
        name: "FK_bookings_payment_id",
        columnNames: ["paymentId"],
        referencedTableName: "payments",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Удаляем поля из bookings
    // ============================================

    await queryRunner.dropForeignKey("bookings", "FK_bookings_payment_id");
    await queryRunner.dropColumn("bookings", "paymentAmount");
    await queryRunner.dropColumn("bookings", "paymentRequired");
    await queryRunner.dropColumn("bookings", "paymentStatus");
    await queryRunner.dropColumn("bookings", "paymentId");

    // ============================================
    // Удаляем поля из orders
    // ============================================

    await queryRunner.dropForeignKey("orders", "FK_orders_payment_id");
    await queryRunner.dropColumn("orders", "paymentAmount");
    await queryRunner.dropColumn("orders", "paymentRequired");
    await queryRunner.dropColumn("orders", "paymentStatus");
    await queryRunner.dropColumn("orders", "paymentId");

    // Удаляем enum
    await queryRunner.query(`DROP TYPE "entity_payment_status_enum"`);
  }
}

