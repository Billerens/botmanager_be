import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from "typeorm";

export class AddBookingSystem1700000000010 implements MigrationInterface {
  name = "AddBookingSystem1700000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поля для системы бронирования в таблицу bots
    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "isBookingEnabled",
        type: "boolean",
        default: false,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingTitle",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingDescription",
        type: "text",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingLogoUrl",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingCustomStyles",
        type: "text",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingButtonTypes",
        type: "json",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingButtonSettings",
        type: "json",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "bookingSettings",
        type: "json",
        isNullable: true,
      })
    );

    // Создаем таблицу specialists
    await queryRunner.createTable(
      new Table({
        name: "specialists",
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
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "avatarUrl",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "phone",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "email",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "isActive",
            type: "boolean",
            default: true,
          },
          {
            name: "workingHours",
            type: "json",
            isNullable: true,
          },
          {
            name: "breakTimes",
            type: "json",
            isNullable: true,
          },
          {
            name: "defaultSlotDuration",
            type: "integer",
            default: 30,
          },
          {
            name: "bufferTime",
            type: "integer",
            default: 0,
          },
          {
            name: "notes",
            type: "text",
            isNullable: true,
          },
          {
            name: "metadata",
            type: "json",
            isNullable: true,
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
          {
            name: "botId",
            type: "uuid",
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Создаем таблицу services
    await queryRunner.createTable(
      new Table({
        name: "services",
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
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "price",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: "duration",
            type: "integer",
            default: 30,
          },
          {
            name: "isActive",
            type: "boolean",
            default: true,
          },
          {
            name: "category",
            type: "json",
            isNullable: true,
          },
          {
            name: "requirements",
            type: "json",
            isNullable: true,
          },
          {
            name: "notes",
            type: "text",
            isNullable: true,
          },
          {
            name: "metadata",
            type: "json",
            isNullable: true,
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
          {
            name: "specialistId",
            type: "uuid",
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Создаем таблицу time_slots
    await queryRunner.createTable(
      new Table({
        name: "time_slots",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "startTime",
            type: "timestamp",
            isNullable: false,
          },
          {
            name: "endTime",
            type: "timestamp",
            isNullable: false,
          },
          {
            name: "isAvailable",
            type: "boolean",
            default: true,
          },
          {
            name: "isBooked",
            type: "boolean",
            default: false,
          },
          {
            name: "metadata",
            type: "json",
            isNullable: true,
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
          {
            name: "specialistId",
            type: "uuid",
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Создаем таблицу bookings
    await queryRunner.createTable(
      new Table({
        name: "bookings",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "clientName",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "clientPhone",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "clientEmail",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "telegramUserId",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "notes",
            type: "text",
            isNullable: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["pending", "confirmed", "cancelled", "completed", "no_show"],
            default: "pending",
          },
          {
            name: "source",
            type: "enum",
            enum: ["telegram_bot", "mini_app", "website", "phone", "other"],
            default: "mini_app",
          },
          {
            name: "confirmedAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "cancelledAt",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "cancellationReason",
            type: "text",
            isNullable: true,
          },
          {
            name: "clientData",
            type: "json",
            isNullable: true,
          },
          {
            name: "confirmationCode",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "confirmationCodeExpires",
            type: "timestamp",
            isNullable: true,
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
          {
            name: "specialistId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "serviceId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "timeSlotId",
            type: "uuid",
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Создаем внешние ключи
    await queryRunner.createForeignKey(
      "specialists",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "services",
      new TableForeignKey({
        columnNames: ["specialistId"],
        referencedColumnNames: ["id"],
        referencedTableName: "specialists",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "time_slots",
      new TableForeignKey({
        columnNames: ["specialistId"],
        referencedColumnNames: ["id"],
        referencedTableName: "specialists",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "bookings",
      new TableForeignKey({
        columnNames: ["specialistId"],
        referencedColumnNames: ["id"],
        referencedTableName: "specialists",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "bookings",
      new TableForeignKey({
        columnNames: ["serviceId"],
        referencedColumnNames: ["id"],
        referencedTableName: "services",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "bookings",
      new TableForeignKey({
        columnNames: ["timeSlotId"],
        referencedColumnNames: ["id"],
        referencedTableName: "time_slots",
        onDelete: "CASCADE",
      })
    );

    // Создаем индексы для оптимизации запросов
    await queryRunner.query(
      `CREATE INDEX "IDX_specialists_botId" ON "specialists" ("botId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_specialists_isActive" ON "specialists" ("isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_services_specialistId" ON "services" ("specialistId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_services_isActive" ON "services" ("isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_time_slots_specialistId" ON "time_slots" ("specialistId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_time_slots_startTime" ON "time_slots" ("startTime")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_time_slots_isAvailable" ON "time_slots" ("isAvailable")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_time_slots_isBooked" ON "time_slots" ("isBooked")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_specialistId" ON "bookings" ("specialistId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_serviceId" ON "bookings" ("serviceId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_timeSlotId" ON "bookings" ("timeSlotId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_status" ON "bookings" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_telegramUserId" ON "bookings" ("telegramUserId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_confirmationCode" ON "bookings" ("confirmationCode")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.query(`DROP INDEX "IDX_bookings_confirmationCode"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_telegramUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_timeSlotId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_serviceId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_specialistId"`);
    await queryRunner.query(`DROP INDEX "IDX_time_slots_isBooked"`);
    await queryRunner.query(`DROP INDEX "IDX_time_slots_isAvailable"`);
    await queryRunner.query(`DROP INDEX "IDX_time_slots_startTime"`);
    await queryRunner.query(`DROP INDEX "IDX_time_slots_specialistId"`);
    await queryRunner.query(`DROP INDEX "IDX_services_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_services_specialistId"`);
    await queryRunner.query(`DROP INDEX "IDX_specialists_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_specialists_botId"`);

    // Удаляем таблицы в обратном порядке
    await queryRunner.dropTable("bookings");
    await queryRunner.dropTable("time_slots");
    await queryRunner.dropTable("services");
    await queryRunner.dropTable("specialists");

    // Удаляем поля из таблицы bots
    await queryRunner.dropColumn("bots", "bookingSettings");
    await queryRunner.dropColumn("bots", "bookingButtonSettings");
    await queryRunner.dropColumn("bots", "bookingButtonTypes");
    await queryRunner.dropColumn("bots", "bookingCustomStyles");
    await queryRunner.dropColumn("bots", "bookingLogoUrl");
    await queryRunner.dropColumn("bots", "bookingDescription");
    await queryRunner.dropColumn("bots", "bookingTitle");
    await queryRunner.dropColumn("bots", "isBookingEnabled");
  }
}
