import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSessionsTable1700000000024 implements MigrationInterface {
  name = "AddUserSessionsTable1700000000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу для пользовательских сессий
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sessionKey" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "chatId" character varying NOT NULL,
        "botId" uuid NOT NULL,
        "currentNodeId" character varying,
        "variables" jsonb NOT NULL DEFAULT '{}',
        "lastActivity" TIMESTAMP NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "sessionType" character varying NOT NULL DEFAULT 'individual',
        "locationRequest" jsonb,
        "lobbyData" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions" PRIMARY KEY ("id")
      )
    `);

    // Создаем индексы для оптимизации запросов
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_sessions_sessionKey" ON "user_sessions" ("sessionKey")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_sessions_botId_userId" ON "user_sessions" ("botId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_sessions_botId_status" ON "user_sessions" ("botId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_sessions_lastActivity" ON "user_sessions" ("lastActivity")
    `);

    // Добавляем внешний ключ на таблицу bots
    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD CONSTRAINT "FK_user_sessions_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешний ключ
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_botId"`);

    // Удаляем индексы
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_sessions_lastActivity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_sessions_botId_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_sessions_botId_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_sessions_sessionKey"`);

    // Удаляем таблицу
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
