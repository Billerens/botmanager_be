import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from "typeorm";

/**
 * Миграция для создания таблицы shops и выделения магазинов в отдельную сущность
 *
 * Эта миграция:
 * 1. Создает новую таблицу shops
 * 2. Добавляет поле shopId в зависимые таблицы (products, categories, orders, carts, shop_promocodes, public_users)
 * 3. Мигрирует данные из bots (где isShop = true) в shops
 * 4. Заполняет shopId в зависимых таблицах на основе botId
 * 5. Добавляет индексы и foreign keys
 *
 * ВАЖНО: Эта миграция НЕ удаляет старые поля из bots для обратной совместимости.
 * Удаление старых полей должно быть выполнено в отдельной миграции после полного перехода.
 */
export class CreateShopsTable1700000000032 implements MigrationInterface {
  name = "CreateShopsTable1700000000032";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Создаем таблицу shops
    await queryRunner.createTable(
      new Table({
        name: "shops",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "name",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "ownerId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "botId",
            type: "uuid",
            isNullable: true,
            isUnique: true, // Связь 1:1 с ботом
          },
          {
            name: "logoUrl",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "title",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "customStyles",
            type: "text",
            isNullable: true,
          },
          {
            name: "buttonTypes",
            type: "json",
            isNullable: true,
          },
          {
            name: "buttonSettings",
            type: "json",
            isNullable: true,
          },
          {
            name: "layoutConfig",
            type: "json",
            isNullable: true,
          },
          {
            name: "browserAccessEnabled",
            type: "boolean",
            default: false,
          },
          {
            name: "browserAccessRequireEmailVerification",
            type: "boolean",
            default: false,
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

    // 2. Добавляем foreign keys для shops
    await queryRunner.createForeignKey(
      "shops",
      new TableForeignKey({
        columnNames: ["ownerId"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "shops",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "SET NULL",
      })
    );

    // 3. Добавляем shopId в зависимые таблицы
    const tables = [
      "products",
      "categories",
      "orders",
      "carts",
      "shop_promocodes",
      "public_users",
    ];

    for (const table of tables) {
      // Проверяем, существует ли уже столбец shopId
      const tableColumns = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'shopId'`
      );

      if (tableColumns.length === 0) {
        await queryRunner.query(`ALTER TABLE "${table}" ADD "shopId" uuid`);
      }
    }

    // 4. Мигрируем данные из bots в shops (для ботов где isShop = true)
    await queryRunner.query(`
      INSERT INTO "shops" (
        "id", "name", "ownerId", "botId", "logoUrl", "title", "description",
        "customStyles", "buttonTypes", "buttonSettings", "layoutConfig", 
        "browserAccessEnabled", "browserAccessRequireEmailVerification", 
        "createdAt", "updatedAt"
      )
      SELECT 
        uuid_generate_v4() as "id",
        COALESCE("shopTitle", "name") as "name",
        "ownerId",
        "id" as "botId",
        "shopLogoUrl" as "logoUrl",
        "shopTitle" as "title",
        "shopDescription" as "description",
        "shopCustomStyles" as "customStyles",
        "shopButtonTypes" as "buttonTypes",
        "shopButtonSettings" as "buttonSettings",
        "shopLayoutConfig" as "layoutConfig",
        COALESCE("shopBrowserAccessEnabled", false) as "browserAccessEnabled",
        COALESCE("browserAccessRequireEmailVerification", false) as "browserAccessRequireEmailVerification",
        "createdAt",
        "updatedAt"
      FROM "bots"
      WHERE "isShop" = true
    `);

    // 5. Заполняем shopId в зависимых таблицах на основе botId
    for (const table of tables) {
      await queryRunner.query(`
        UPDATE "${table}" t 
        SET "shopId" = s."id" 
        FROM "shops" s 
        WHERE t."botId" = s."botId"
      `);
    }

    // 6. Создаем индексы для shopId
    for (const table of tables) {
      await queryRunner.createIndex(
        table,
        new TableIndex({
          name: `IDX_${table}_shopId`,
          columnNames: ["shopId"],
        })
      );
    }

    // 7. Создаем составные индексы для orders и carts
    await queryRunner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_shopId_telegramUsername",
        columnNames: ["shopId", "telegramUsername"],
      })
    );

    await queryRunner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_shopId_publicUserId",
        columnNames: ["shopId", "publicUserId"],
      })
    );

    await queryRunner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_shopId_status",
        columnNames: ["shopId", "status"],
      })
    );

    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_shopId_telegramUsername",
        columnNames: ["shopId", "telegramUsername"],
      })
    );

    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_shopId_publicUserId",
        columnNames: ["shopId", "publicUserId"],
      })
    );

    // 8. Создаем уникальный индекс для shop_promocodes (shopId, code)
    await queryRunner.createIndex(
      "shop_promocodes",
      new TableIndex({
        name: "IDX_shop_promocodes_shopId_code_unique",
        columnNames: ["shopId", "code"],
        isUnique: true,
      })
    );

    // 9. Создаем индексы для public_users
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_email_shopId",
        columnNames: ["email", "shopId"],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_shopId_telegramId",
        columnNames: ["shopId", "telegramId"],
      })
    );

    // 10. Добавляем foreign keys для shopId в зависимых таблицах
    for (const table of tables) {
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          name: `FK_${table}_shopId`,
          columnNames: ["shopId"],
          referencedColumnNames: ["id"],
          referencedTableName: "shops",
          onDelete: "CASCADE",
        })
      );
    }

    // 11. Делаем botId nullable в зависимых таблицах (для обратной совместимости)
    for (const table of tables) {
      try {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "botId" DROP NOT NULL`
        );
      } catch (e) {
        // Игнорируем ошибку если столбец уже nullable
        console.log(
          `Column botId in ${table} is already nullable or doesn't exist`
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем foreign keys
    const tables = [
      "products",
      "categories",
      "orders",
      "carts",
      "shop_promocodes",
      "public_users",
    ];

    for (const table of tables) {
      try {
        await queryRunner.dropForeignKey(table, `FK_${table}_shopId`);
      } catch (e) {
        console.log(`FK_${table}_shopId not found, skipping`);
      }
    }

    // Удаляем индексы
    await queryRunner.dropIndex(
      "public_users",
      "IDX_public_users_shopId_telegramId"
    );
    await queryRunner.dropIndex(
      "public_users",
      "IDX_public_users_email_shopId"
    );
    await queryRunner.dropIndex(
      "shop_promocodes",
      "IDX_shop_promocodes_shopId_code_unique"
    );
    await queryRunner.dropIndex("carts", "IDX_carts_shopId_publicUserId");
    await queryRunner.dropIndex("carts", "IDX_carts_shopId_telegramUsername");
    await queryRunner.dropIndex("orders", "IDX_orders_shopId_status");
    await queryRunner.dropIndex("orders", "IDX_orders_shopId_publicUserId");
    await queryRunner.dropIndex("orders", "IDX_orders_shopId_telegramUsername");

    for (const table of tables) {
      try {
        await queryRunner.dropIndex(table, `IDX_${table}_shopId`);
      } catch (e) {
        console.log(`IDX_${table}_shopId not found, skipping`);
      }
    }

    // Удаляем столбец shopId из зависимых таблиц
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "shopId"`
      );
    }

    // Удаляем таблицу shops
    await queryRunner.dropTable("shops", true);
  }
}
