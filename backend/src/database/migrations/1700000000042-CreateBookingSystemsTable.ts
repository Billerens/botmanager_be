import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class CreateBookingSystemsTable1700000000042
  implements MigrationInterface
{
  name = "CreateBookingSystemsTable1700000000042";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Создаем таблицу booking_systems
    await queryRunner.createTable(
      new Table({
        name: "booking_systems",
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
            name: "slug",
            type: "varchar",
            isNullable: true,
            isUnique: true,
          },
          {
            name: "subdomainStatus",
            type: "enum",
            enum: [
              "pending",
              "dns_creating",
              "activating",
              "active",
              "error",
              "inactive",
            ],
            isNullable: true,
          },
          {
            name: "subdomainError",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "subdomainActivatedAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "subdomainUrl",
            type: "varchar",
            isNullable: true,
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
            isUnique: true,
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
            name: "settings",
            type: "json",
            isNullable: true,
          },
          {
            name: "browserAccessEnabled",
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

    // 2. Добавляем foreign keys для booking_systems
    await queryRunner.createForeignKey(
      "booking_systems",
      new TableForeignKey({
        columnNames: ["ownerId"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "booking_systems",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "SET NULL",
      })
    );

    // 3. Добавляем колонку bookingSystemId в таблицу specialists
    await queryRunner.query(`
      ALTER TABLE "specialists" 
      ADD COLUMN IF NOT EXISTS "bookingSystemId" uuid
    `);

    // 4. Создаем индекс для bookingSystemId
    await queryRunner.createIndex(
      "specialists",
      new TableIndex({
        name: "IDX_specialists_bookingSystemId",
        columnNames: ["bookingSystemId"],
      })
    );

    // 5. Добавляем foreign key для specialists.bookingSystemId
    await queryRunner.createForeignKey(
      "specialists",
      new TableForeignKey({
        name: "FK_specialists_bookingSystemId",
        columnNames: ["bookingSystemId"],
        referencedColumnNames: ["id"],
        referencedTableName: "booking_systems",
        onDelete: "CASCADE",
      })
    );

    // 6. Мигрируем данные: создаем BookingSystem для каждого бота с isBookingEnabled = true
    await queryRunner.query(`
      INSERT INTO "booking_systems" (
        "id",
        "name",
        "slug",
        "subdomainStatus",
        "subdomainError",
        "subdomainActivatedAt",
        "subdomainUrl",
        "ownerId",
        "botId",
        "logoUrl",
        "title",
        "description",
        "customStyles",
        "buttonTypes",
        "buttonSettings",
        "settings",
        "browserAccessEnabled",
        "createdAt",
        "updatedAt"
      )
      SELECT 
        uuid_generate_v4(),
        COALESCE(b."bookingTitle", b."name", 'Система бронирования'),
        b."slug",
        b."subdomainStatus"::text::"public"."booking_systems_subdomainstatus_enum",
        b."subdomainError",
        b."subdomainActivatedAt",
        b."subdomainUrl",
        b."ownerId",
        b."id",
        b."bookingLogoUrl",
        b."bookingTitle",
        b."bookingDescription",
        b."bookingCustomStyles",
        b."bookingButtonTypes",
        b."bookingButtonSettings",
        b."bookingSettings",
        COALESCE(b."bookingBrowserAccessEnabled", false),
        NOW(),
        NOW()
      FROM "bots" b
      WHERE b."isBookingEnabled" = true
    `);

    // 7. Обновляем specialists.bookingSystemId на основе связи с botId
    await queryRunner.query(`
      UPDATE "specialists" s
      SET "bookingSystemId" = bs."id"
      FROM "booking_systems" bs
      WHERE s."botId" = bs."botId"
    `);

    // 8. Делаем botId nullable в specialists (если еще не nullable)
    await queryRunner.query(`
      ALTER TABLE "specialists" 
      ALTER COLUMN "botId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Восстанавливаем NOT NULL для botId в specialists
    // Сначала заполняем пустые значения
    await queryRunner.query(`
      UPDATE "specialists" s
      SET "botId" = bs."botId"
      FROM "booking_systems" bs
      WHERE s."bookingSystemId" = bs."id" AND s."botId" IS NULL
    `);

    // 2. Удаляем foreign key для specialists.bookingSystemId
    await queryRunner.dropForeignKey(
      "specialists",
      "FK_specialists_bookingSystemId"
    );

    // 3. Удаляем индекс
    await queryRunner.dropIndex(
      "specialists",
      "IDX_specialists_bookingSystemId"
    );

    // 4. Удаляем колонку bookingSystemId из specialists
    await queryRunner.query(`
      ALTER TABLE "specialists" 
      DROP COLUMN IF EXISTS "bookingSystemId"
    `);

    // 5. Удаляем foreign keys из booking_systems
    const table = await queryRunner.getTable("booking_systems");
    const foreignKeys = table?.foreignKeys || [];

    for (const fk of foreignKeys) {
      await queryRunner.dropForeignKey("booking_systems", fk);
    }

    // 6. Удаляем таблицу booking_systems
    await queryRunner.dropTable("booking_systems");
  }
}
