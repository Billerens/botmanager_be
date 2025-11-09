import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActivityLogsIndexes1700000000023 implements MigrationInterface {
  name = "AddActivityLogsIndexes1700000000023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем составные индексы для оптимизации запросов
    // Индекс для фильтрации по userId с сортировкой по дате
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_userId_createdAt" ON "activity_logs" ("userId", "createdAt")`
    );

    // Индекс для фильтрации по botId с сортировкой по дате
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_botId_createdAt" ON "activity_logs" ("botId", "createdAt")`
    );

    // Индекс для фильтрации по type с сортировкой по дате
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_type_createdAt" ON "activity_logs" ("type", "createdAt")`
    );

    // Индекс для фильтрации по level с сортировкой по дате
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_level_createdAt" ON "activity_logs" ("level", "createdAt")`
    );

    // Индекс для операций cleanup и сортировки по дате
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_createdAt" ON "activity_logs" ("createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы в обратном порядке
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_createdAt"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_level_createdAt"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_type_createdAt"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_botId_createdAt"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_logs_userId_createdAt"`
    );
  }
}

