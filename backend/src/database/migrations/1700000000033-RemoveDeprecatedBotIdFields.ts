import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Миграция для удаления устаревших полей botId из таблиц,
 * связанных с магазином, после перехода на архитектуру Shop entity.
 *
 * Удаляемые поля:
 * - botId из products, categories, orders, carts, shop_promocodes, public_users
 * - shop* поля из bots (isShop, shopLogoUrl, shopTitle, etc.)
 *
 * ВАЖНО: Перед запуском убедитесь, что все данные перенесены в таблицу shops
 * и связи через shopId установлены корректно.
 */
export class RemoveDeprecatedBotIdFields1700000000033
  implements MigrationInterface
{
  name = "RemoveDeprecatedBotIdFields1700000000033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // 1. Удаление внешних ключей botId из таблиц магазина
    // =====================================================

    // Products - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "products" 
      DROP CONSTRAINT IF EXISTS "FK_products_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_products_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // Categories - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "categories" 
      DROP CONSTRAINT IF EXISTS "FK_categories_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_categories_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "categories" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // Orders - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "orders" 
      DROP CONSTRAINT IF EXISTS "FK_orders_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_orders_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // Carts - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "carts" 
      DROP CONSTRAINT IF EXISTS "FK_carts_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_carts_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // Shop Promocodes - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      DROP CONSTRAINT IF EXISTS "FK_shop_promocodes_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_shop_promocodes_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // Public Users - удаляем FK и индекс botId
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP CONSTRAINT IF EXISTS "FK_public_users_bot"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP COLUMN IF EXISTS "botId"
    `);

    // =====================================================
    // 2. Удаление устаревших shop* полей из таблицы bots
    // =====================================================

    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "isShop"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopLogoUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopTitle"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopDescription"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopCustomStyles"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopButtonTypes"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopButtonSettings"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopLayoutConfig"
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      DROP COLUMN IF EXISTS "shopBrowserAccessEnabled"
    `);
    // browserAccessRequireEmailVerification может использоваться для бронирования,
    // поэтому не удаляем его

    console.log("✅ Устаревшие поля botId и shop* успешно удалены");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // Восстановление shop* полей в таблице bots
    // =====================================================

    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "isShop" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopLogoUrl" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopTitle" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopDescription" text
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopCustomStyles" text
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopButtonTypes" text[] DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopButtonSettings" jsonb DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopLayoutConfig" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "bots" 
      ADD COLUMN IF NOT EXISTS "shopBrowserAccessEnabled" boolean DEFAULT false
    `);

    // =====================================================
    // Восстановление botId в таблицах магазина
    // =====================================================

    // Products
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_botId" ON "products" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD CONSTRAINT "FK_products_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Categories
    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_categories_botId" ON "categories" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "FK_categories_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Orders
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_botId" ON "orders" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD CONSTRAINT "FK_orders_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Carts
    await queryRunner.query(`
      ALTER TABLE "carts" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_carts_botId" ON "carts" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "carts" 
      ADD CONSTRAINT "FK_carts_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Shop Promocodes
    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shop_promocodes_botId" ON "shop_promocodes" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "shop_promocodes" 
      ADD CONSTRAINT "FK_shop_promocodes_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Public Users
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_public_users_botId" ON "public_users" ("botId")
    `);
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD CONSTRAINT "FK_public_users_bot" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    console.log("✅ Поля botId и shop* восстановлены (откат миграции)");
  }
}
