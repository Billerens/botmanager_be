import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPromocodeFieldsToOrders1700000000020
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле appliedPromocodeId в таблицу orders
    await queryRunner.addColumn(
      "orders",
      new TableColumn({
        name: "appliedPromocodeId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Добавляем поле promocodeDiscount в таблицу orders
    await queryRunner.addColumn(
      "orders",
      new TableColumn({
        name: "promocodeDiscount",
        type: "numeric",
        precision: 10,
        scale: 2,
        isNullable: true,
      })
    );

    // Создаем внешний ключ для appliedPromocodeId
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD CONSTRAINT "FK_orders_appliedPromocodeId" 
      FOREIGN KEY ("appliedPromocodeId") REFERENCES "shop_promocodes"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "orders" 
      DROP CONSTRAINT IF EXISTS "FK_orders_appliedPromocodeId"
    `);

    // Удаляем поля
    await queryRunner.dropColumn("orders", "promocodeDiscount");
    await queryRunner.dropColumn("orders", "appliedPromocodeId");
  }
}

