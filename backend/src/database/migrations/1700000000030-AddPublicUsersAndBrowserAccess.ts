import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
  TableColumn,
} from "typeorm";

export class AddPublicUsersAndBrowserAccess1700000000030
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Создаем таблицу public_users
    await queryRunner.createTable(
      new Table({
        name: "public_users",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "email",
            type: "varchar",
            isUnique: true,
            isNullable: false,
          },
          {
            name: "passwordHash",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "firstName",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "lastName",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "phone",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "telegramId",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "telegramUsername",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "isEmailVerified",
            type: "boolean",
            default: false,
          },
          {
            name: "emailVerificationCode",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "emailVerificationCodeExpires",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "passwordResetToken",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "passwordResetTokenExpires",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "refreshToken",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "lastLoginAt",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamptz",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamptz",
            default: "now()",
          },
        ],
      }),
      true
    );

    // Индекс по email
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_email",
        columnNames: ["email"],
        isUnique: true,
      })
    );

    // Индекс по telegramId для связывания аккаунтов
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_telegramId",
        columnNames: ["telegramId"],
      })
    );

    // 2. Добавляем поля браузерного доступа в таблицу bots
    await queryRunner.addColumns("bots", [
      new TableColumn({
        name: "shopBrowserAccessEnabled",
        type: "boolean",
        default: false,
      }),
      new TableColumn({
        name: "bookingBrowserAccessEnabled",
        type: "boolean",
        default: false,
      }),
      new TableColumn({
        name: "browserAccessRequireEmailVerification",
        type: "boolean",
        default: false,
      }),
    ]);

    // 3. Добавляем publicUserId в таблицу carts
    // Сначала удаляем старый уникальный индекс
    try {
      await queryRunner.dropIndex("carts", "IDX_carts_botId_telegramUsername");
    } catch (e) {
      // Индекс может не существовать
    }

    // Делаем telegramUsername nullable
    await queryRunner.changeColumn(
      "carts",
      "telegramUsername",
      new TableColumn({
        name: "telegramUsername",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "carts",
      new TableColumn({
        name: "publicUserId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Создаем индексы для carts
    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_botId_telegramUsername",
        columnNames: ["botId", "telegramUsername"],
      })
    );

    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_botId_publicUserId",
        columnNames: ["botId", "publicUserId"],
      })
    );

    // Внешний ключ для publicUserId в carts
    await queryRunner.createForeignKey(
      "carts",
      new TableForeignKey({
        name: "FK_carts_publicUserId",
        columnNames: ["publicUserId"],
        referencedColumnNames: ["id"],
        referencedTableName: "public_users",
        onDelete: "CASCADE",
      })
    );

    // 4. Добавляем publicUserId в таблицу orders
    // Делаем telegramUsername nullable
    await queryRunner.changeColumn(
      "orders",
      "telegramUsername",
      new TableColumn({
        name: "telegramUsername",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "orders",
      new TableColumn({
        name: "publicUserId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Индекс для orders
    await queryRunner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_botId_publicUserId",
        columnNames: ["botId", "publicUserId"],
      })
    );

    // Внешний ключ для publicUserId в orders
    await queryRunner.createForeignKey(
      "orders",
      new TableForeignKey({
        name: "FK_orders_publicUserId",
        columnNames: ["publicUserId"],
        referencedColumnNames: ["id"],
        referencedTableName: "public_users",
        onDelete: "SET NULL",
      })
    );

    // 5. Добавляем publicUserId в таблицу bookings
    await queryRunner.addColumn(
      "bookings",
      new TableColumn({
        name: "publicUserId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Индекс для bookings
    await queryRunner.createIndex(
      "bookings",
      new TableIndex({
        name: "IDX_bookings_publicUserId",
        columnNames: ["publicUserId"],
      })
    );

    // Внешний ключ для publicUserId в bookings
    await queryRunner.createForeignKey(
      "bookings",
      new TableForeignKey({
        name: "FK_bookings_publicUserId",
        columnNames: ["publicUserId"],
        referencedColumnNames: ["id"],
        referencedTableName: "public_users",
        onDelete: "SET NULL",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешние ключи
    await queryRunner.dropForeignKey("bookings", "FK_bookings_publicUserId");
    await queryRunner.dropForeignKey("orders", "FK_orders_publicUserId");
    await queryRunner.dropForeignKey("carts", "FK_carts_publicUserId");

    // Удаляем индексы
    await queryRunner.dropIndex("bookings", "IDX_bookings_publicUserId");
    await queryRunner.dropIndex("orders", "IDX_orders_botId_publicUserId");
    await queryRunner.dropIndex("carts", "IDX_carts_botId_publicUserId");
    await queryRunner.dropIndex("carts", "IDX_carts_botId_telegramUsername");

    // Удаляем колонки publicUserId
    await queryRunner.dropColumn("bookings", "publicUserId");
    await queryRunner.dropColumn("orders", "publicUserId");
    await queryRunner.dropColumn("carts", "publicUserId");

    // Возвращаем telegramUsername NOT NULL в carts
    await queryRunner.changeColumn(
      "carts",
      "telegramUsername",
      new TableColumn({
        name: "telegramUsername",
        type: "varchar",
        isNullable: false,
      })
    );

    // Возвращаем telegramUsername NOT NULL в orders
    await queryRunner.changeColumn(
      "orders",
      "telegramUsername",
      new TableColumn({
        name: "telegramUsername",
        type: "varchar",
        isNullable: false,
      })
    );

    // Восстанавливаем уникальный индекс для carts
    await queryRunner.createIndex(
      "carts",
      new TableIndex({
        name: "IDX_carts_botId_telegramUsername",
        columnNames: ["botId", "telegramUsername"],
        isUnique: true,
      })
    );

    // Удаляем поля браузерного доступа из bots
    await queryRunner.dropColumn("bots", "browserAccessRequireEmailVerification");
    await queryRunner.dropColumn("bots", "bookingBrowserAccessEnabled");
    await queryRunner.dropColumn("bots", "shopBrowserAccessEnabled");

    // Удаляем индексы public_users
    await queryRunner.dropIndex("public_users", "IDX_public_users_telegramId");
    await queryRunner.dropIndex("public_users", "IDX_public_users_email");

    // Удаляем таблицу public_users
    await queryRunner.dropTable("public_users");
  }
}

