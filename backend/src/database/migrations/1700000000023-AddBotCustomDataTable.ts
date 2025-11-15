import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBotCustomDataTable1700000000023 implements MigrationInterface {
  name = "AddBotCustomDataTable1700000000023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу для кастомных данных ботов
    await queryRunner.query(`
      CREATE TABLE "bot_custom_data" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "collection" character varying NOT NULL,
        "key" character varying,
        "data" jsonb NOT NULL,
        "metadata" jsonb,
        "dataType" character varying NOT NULL DEFAULT 'json_table',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_custom_data" PRIMARY KEY ("id")
      )
    `);

    // Создаем индексы для оптимизации запросов
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_custom_data_botId_collection" ON "bot_custom_data" ("botId", "collection")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bot_custom_data_botId_collection_key" ON "bot_custom_data" ("botId", "collection", "key")
    `);

    // Добавляем внешний ключ на таблицу bots
    await queryRunner.query(`
      ALTER TABLE "bot_custom_data"
      ADD CONSTRAINT "FK_bot_custom_data_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    await queryRunner.query(`ALTER TABLE "bot_custom_data" DROP CONSTRAINT "FK_bot_custom_data_botId"`);

    // Удаляем индексы
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bot_custom_data_botId_collection_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bot_custom_data_botId_collection"`);

    // Удаляем таблицу
    await queryRunner.query(`DROP TABLE "bot_custom_data"`);
  }
}
