import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBotUsersAndPermissionsSystem1700000000029
  implements MigrationInterface
{
  name = "AddBotUsersAndPermissionsSystem1700000000029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем ENUM для действий с разрешениями
    await queryRunner.query(`
      CREATE TYPE bot_user_permissions_action_enum AS ENUM (
        'read', 'create', 'update', 'delete'
      )
    `);

    // Создаем ENUM для сущностей бота
    await queryRunner.query(`
      CREATE TYPE bot_user_permissions_entity_enum AS ENUM (
        'bot_settings', 'flows', 'messages', 'leads', 'products', 'categories',
        'orders', 'carts', 'specialists', 'bookings', 'analytics', 'shop_settings',
        'booking_settings', 'custom_pages', 'bot_users'
      )
    `);

    // Создаем ENUM для статуса приглашений
    await queryRunner.query(`
      CREATE TYPE bot_invitations_status_enum AS ENUM (
        'pending', 'accepted', 'declined', 'expired'
      )
    `);

    // Создаем таблицу bot_users (связь пользователей с ботами)
    await queryRunner.query(`
      CREATE TABLE "bot_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "displayName" character varying,
        "permissions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bot_users_bot_user" UNIQUE ("botId", "userId")
      )
    `);

    // Создаем таблицу bot_user_permissions (детальные разрешения)
    await queryRunner.query(`
      CREATE TABLE "bot_user_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "entity" bot_user_permissions_entity_enum NOT NULL,
        "action" bot_user_permissions_action_enum NOT NULL,
        "granted" boolean NOT NULL DEFAULT false,
        "grantedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_user_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bot_user_permissions_unique" UNIQUE ("botId", "userId", "entity", "action")
      )
    `);

    // Создаем таблицу bot_invitations (приглашения пользователей)
    await queryRunner.query(`
      CREATE TABLE "bot_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "botId" uuid NOT NULL,
        "invitedTelegramId" character varying NOT NULL,
        "invitedUserId" uuid,
        "status" bot_invitations_status_enum NOT NULL DEFAULT 'pending',
        "permissions" jsonb NOT NULL,
        "invitedByUserId" uuid NOT NULL,
        "invitationToken" character varying,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bot_invitations_token" UNIQUE ("invitationToken")
      )
    `);

    // Добавляем индексы для производительности
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_users_bot_id" ON "bot_users" ("botId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_users_user_id" ON "bot_users" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_user_permissions_bot_id" ON "bot_user_permissions" ("botId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_user_permissions_user_id" ON "bot_user_permissions" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_invitations_bot_id" ON "bot_invitations" ("botId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_invitations_invited_telegram_id" ON "bot_invitations" ("invitedTelegramId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bot_invitations_status" ON "bot_invitations" ("status")
    `);

    // Добавляем внешние ключи
    await queryRunner.query(`
      ALTER TABLE "bot_users"
      ADD CONSTRAINT "FK_bot_users_bot_id" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_bot_users_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "bot_user_permissions"
      ADD CONSTRAINT "FK_bot_user_permissions_bot_id" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_bot_user_permissions_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_bot_user_permissions_granted_by" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "bot_invitations"
      ADD CONSTRAINT "FK_bot_invitations_bot_id" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_bot_invitations_invited_user_id" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_bot_invitations_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем внешние ключи
    await queryRunner.query(`ALTER TABLE "bot_invitations" DROP CONSTRAINT "FK_bot_invitations_invited_by"`);
    await queryRunner.query(`ALTER TABLE "bot_invitations" DROP CONSTRAINT "FK_bot_invitations_invited_user_id"`);
    await queryRunner.query(`ALTER TABLE "bot_invitations" DROP CONSTRAINT "FK_bot_invitations_bot_id"`);

    await queryRunner.query(`ALTER TABLE "bot_user_permissions" DROP CONSTRAINT "FK_bot_user_permissions_granted_by"`);
    await queryRunner.query(`ALTER TABLE "bot_user_permissions" DROP CONSTRAINT "FK_bot_user_permissions_user_id"`);
    await queryRunner.query(`ALTER TABLE "bot_user_permissions" DROP CONSTRAINT "FK_bot_user_permissions_bot_id"`);

    await queryRunner.query(`ALTER TABLE "bot_users" DROP CONSTRAINT "FK_bot_users_user_id"`);
    await queryRunner.query(`ALTER TABLE "bot_users" DROP CONSTRAINT "FK_bot_users_bot_id"`);

    // Удаляем индексы
    await queryRunner.query(`DROP INDEX "IDX_bot_invitations_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_invitations_invited_telegram_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_invitations_bot_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_user_permissions_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_user_permissions_bot_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_users_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_users_bot_id"`);

    // Удаляем таблицы
    await queryRunner.query(`DROP TABLE "bot_invitations"`);
    await queryRunner.query(`DROP TABLE "bot_user_permissions"`);
    await queryRunner.query(`DROP TABLE "bot_users"`);

    // Удаляем ENUM типы
    await queryRunner.query(`DROP TYPE bot_invitations_status_enum`);
    await queryRunner.query(`DROP TYPE bot_user_permissions_entity_enum`);
    await queryRunner.query(`DROP TYPE bot_user_permissions_action_enum`);
  }
}
