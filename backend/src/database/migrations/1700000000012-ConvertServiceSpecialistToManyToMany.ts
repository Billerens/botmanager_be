import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class ConvertServiceSpecialistToManyToMany1700000000012
  implements MigrationInterface
{
  name = "ConvertServiceSpecialistToManyToMany1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индекс для specialistId
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_services_specialistId"`);

    // Удаляем внешний ключ между services и specialists
    const servicesTable = await queryRunner.getTable("services");
    const foreignKey = servicesTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("specialistId") !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey("services", foreignKey);
    }

    // Создаем junction таблицу для many-to-many связи
    await queryRunner.createTable(
      new Table({
        name: "service_specialists",
        columns: [
          {
            name: "serviceId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "specialistId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Создаем составной первичный ключ
    await queryRunner.createPrimaryKey("service_specialists", [
      "serviceId",
      "specialistId",
    ]);

    // Создаем внешние ключи для junction таблицы
    await queryRunner.createForeignKey(
      "service_specialists",
      new TableForeignKey({
        columnNames: ["serviceId"],
        referencedColumnNames: ["id"],
        referencedTableName: "services",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "service_specialists",
      new TableForeignKey({
        columnNames: ["specialistId"],
        referencedColumnNames: ["id"],
        referencedTableName: "specialists",
        onDelete: "CASCADE",
      })
    );

    // Создаем индексы для оптимизации запросов
    await queryRunner.query(
      `CREATE INDEX "IDX_service_specialists_serviceId" ON "service_specialists" ("serviceId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_specialists_specialistId" ON "service_specialists" ("specialistId")`
    );

    // Мигрируем существующие данные из services в junction таблицу
    await queryRunner.query(`
      INSERT INTO "service_specialists" ("serviceId", "specialistId", "createdAt")
      SELECT "id", "specialistId", CURRENT_TIMESTAMP
      FROM "services"
      WHERE "specialistId" IS NOT NULL
    `);

    // Удаляем колонку specialistId из services
    await queryRunner.dropColumn("services", "specialistId");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Добавляем колонку specialistId обратно в services
    await queryRunner.query(`
      ALTER TABLE "services"
      ADD COLUMN "specialistId" uuid
    `);

    // Восстанавливаем данные из junction таблицы (берем первого специалиста для каждой услуги)
    await queryRunner.query(`
      UPDATE "services" s
      SET "specialistId" = (
        SELECT "specialistId"
        FROM "service_specialists" ss
        WHERE ss."serviceId" = s."id"
        LIMIT 1
      )
    `);

    // Делаем specialistId NOT NULL
    await queryRunner.query(`
      ALTER TABLE "services"
      ALTER COLUMN "specialistId" SET NOT NULL
    `);

    // Восстанавливаем внешний ключ
    await queryRunner.createForeignKey(
      "services",
      new TableForeignKey({
        columnNames: ["specialistId"],
        referencedColumnNames: ["id"],
        referencedTableName: "specialists",
        onDelete: "CASCADE",
      })
    );

    // Восстанавливаем индекс
    await queryRunner.query(
      `CREATE INDEX "IDX_services_specialistId" ON "services" ("specialistId")`
    );

    // Удаляем индексы junction таблицы
    await queryRunner.query(
      `DROP INDEX "IDX_service_specialists_specialistId"`
    );
    await queryRunner.query(`DROP INDEX "IDX_service_specialists_serviceId"`);

    // Удаляем junction таблицу
    await queryRunner.dropTable("service_specialists");
  }
}
