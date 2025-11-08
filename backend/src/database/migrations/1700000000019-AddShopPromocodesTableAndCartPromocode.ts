import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddShopPromocodesTableAndCartPromocode1700000000019
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем ENUM типы для PostgreSQL
    await queryRunner.query(`
      CREATE TYPE shop_promocode_type_enum AS ENUM ('fixed', 'percentage')
    `);

    await queryRunner.query(`
      CREATE TYPE shop_promocode_applicable_to_enum AS ENUM ('cart', 'category', 'product')
    `);

    await queryRunner.query(`
      CREATE TYPE shop_promocode_usage_limit_enum AS ENUM ('single_use', 'limited', 'unlimited')
    `);

    // Создаем таблицу shop_promocodes
    await queryRunner.query(`
      CREATE TABLE "shop_promocodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "code" character varying(100) NOT NULL,
        "type" shop_promocode_type_enum NOT NULL DEFAULT 'percentage',
        "value" numeric(10,2) NOT NULL,
        "applicableTo" shop_promocode_applicable_to_enum NOT NULL DEFAULT 'cart',
        "categoryId" uuid,
        "productId" uuid,
        "usageLimit" shop_promocode_usage_limit_enum NOT NULL DEFAULT 'unlimited',
        "maxUsageCount" integer,
        "currentUsageCount" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "validFrom" timestamptz,
        "validUntil" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_promocodes" PRIMARY KEY ("id")
      )
    `);

    // Создаем уникальный индекс для botId + code
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_shop_promocodes_botId_code" 
      ON "shop_promocodes" ("botId", "code")
    `);

    // Создаем внешние ключи
    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      ADD CONSTRAINT "FK_shop_promocodes_botId" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      ADD CONSTRAINT "FK_shop_promocodes_categoryId" 
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      ADD CONSTRAINT "FK_shop_promocodes_productId" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    // Добавляем поле appliedPromocodeId в таблицу carts
    await queryRunner.addColumn(
      "carts",
      new TableColumn({
        name: "appliedPromocodeId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Создаем внешний ключ для appliedPromocodeId
    await queryRunner.query(`
      ALTER TABLE "carts" 
      ADD CONSTRAINT "FK_carts_appliedPromocodeId" 
      FOREIGN KEY ("appliedPromocodeId") REFERENCES "shop_promocodes"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ и поле appliedPromocodeId из carts
    await queryRunner.query(`
      ALTER TABLE "carts" 
      DROP CONSTRAINT IF EXISTS "FK_carts_appliedPromocodeId"
    `);
    await queryRunner.dropColumn("carts", "appliedPromocodeId");

    // Удаляем таблицу shop_promocodes
    await queryRunner.query(`DROP TABLE IF EXISTS "shop_promocodes"`);

    // Удаляем ENUM типы
    await queryRunner.query(
      `DROP TYPE IF EXISTS shop_promocode_usage_limit_enum`
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS shop_promocode_applicable_to_enum`
    );
    await queryRunner.query(`DROP TYPE IF EXISTS shop_promocode_type_enum`);
  }
}
