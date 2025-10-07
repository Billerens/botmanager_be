import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1700000000000 implements MigrationInterface {
  name = "InitialMigration1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем расширения PostgreSQL
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Создаем таблицу users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "firstName" character varying,
        "lastName" character varying,
        "telegramId" character varying,
        "telegramUsername" character varying,
        "role" character varying NOT NULL DEFAULT 'owner',
        "isActive" boolean NOT NULL DEFAULT true,
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationToken" character varying,
        "passwordResetToken" character varying,
        "passwordResetExpires" TIMESTAMP,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу bots
    await queryRunner.query(`
      CREATE TABLE "bots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "username" character varying NOT NULL,
        "token" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'inactive',
        "totalUsers" integer NOT NULL DEFAULT 0,
        "totalMessages" integer NOT NULL DEFAULT 0,
        "totalLeads" integer NOT NULL DEFAULT 0,
        "isWebhookSet" boolean NOT NULL DEFAULT false,
        "lastError" character varying,
        "lastErrorAt" TIMESTAMP,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bots_username" UNIQUE ("username"),
        CONSTRAINT "PK_bots_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу messages
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "messageType" character varying NOT NULL,
        "content" text,
        "mediaUrl" character varying,
        "mediaType" character varying,
        "isFromBot" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу leads
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "telegramId" character varying,
        "telegramUsername" character varying,
        "status" character varying NOT NULL DEFAULT 'new',
        "source" character varying,
        "data" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leads_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу subscriptions
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "plan" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "startDate" TIMESTAMP NOT NULL DEFAULT now(),
        "endDate" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу bot_flows
    await queryRunner.query(`
      CREATE TABLE "bot_flows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_flows_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу bot_flow_nodes
    await queryRunner.query(`
      CREATE TABLE "bot_flow_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "flowId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "position" jsonb NOT NULL,
        "data" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_flow_nodes_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем таблицу activity_logs
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "botId" uuid,
        "action" character varying NOT NULL,
        "description" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id")
      )
    `);

    // Создаем индексы
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bots_userId" ON "bots" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_botId" ON "messages" ("botId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_userId" ON "messages" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leads_botId" ON "leads" ("botId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_userId" ON "subscriptions" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_flows_botId" ON "bot_flows" ("botId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_flow_nodes_flowId" ON "bot_flow_nodes" ("flowId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_userId" ON "activity_logs" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_logs_botId" ON "activity_logs" ("botId")`
    );

    // Создаем внешние ключи
    await queryRunner.query(
      `ALTER TABLE "bots" ADD CONSTRAINT "FK_bots_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD CONSTRAINT "FK_leads_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bot_flows" ADD CONSTRAINT "FK_bot_flows_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "bot_flow_nodes" ADD CONSTRAINT "FK_bot_flow_nodes_flowId" FOREIGN KEY ("flowId") REFERENCES "bot_flows"("id") ON DELETE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_activity_logs_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_activity_logs_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE SET NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешние ключи
    await queryRunner.query(
      `ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_activity_logs_botId"`
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_activity_logs_userId"`
    );
    await queryRunner.query(
      `ALTER TABLE "bot_flow_nodes" DROP CONSTRAINT "FK_bot_flow_nodes_flowId"`
    );
    await queryRunner.query(
      `ALTER TABLE "bot_flows" DROP CONSTRAINT "FK_bot_flows_botId"`
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_userId"`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP CONSTRAINT "FK_leads_botId"`
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_botId"`
    );
    await queryRunner.query(
      `ALTER TABLE "bots" DROP CONSTRAINT "FK_bots_userId"`
    );

    // Удаляем индексы
    await queryRunner.query(`DROP INDEX "IDX_activity_logs_botId"`);
    await queryRunner.query(`DROP INDEX "IDX_activity_logs_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_flow_nodes_flowId"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_flows_botId"`);
    await queryRunner.query(`DROP INDEX "IDX_subscriptions_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_leads_botId"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_botId"`);
    await queryRunner.query(`DROP INDEX "IDX_bots_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);

    // Удаляем таблицы
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TABLE "bot_flow_nodes"`);
    await queryRunner.query(`DROP TABLE "bot_flows"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "bots"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
