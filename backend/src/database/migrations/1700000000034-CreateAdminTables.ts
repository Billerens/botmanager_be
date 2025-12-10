import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAdminTables1700000000034 implements MigrationInterface {
  name = "CreateAdminTables1700000000034";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем enum для ролей админа
    await queryRunner.query(`
      CREATE TYPE "admin_role_enum" AS ENUM ('superadmin', 'support', 'viewer')
    `);

    // Создаем enum для статуса админа
    await queryRunner.query(`
      CREATE TYPE "admin_status_enum" AS ENUM ('active', 'inactive', 'pending_password_change')
    `);

    // Создаем таблицу admins
    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "password" character varying NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "telegramId" character varying NOT NULL,
        "telegramUsername" character varying,
        "role" "admin_role_enum" NOT NULL DEFAULT 'support',
        "status" "admin_status_enum" NOT NULL DEFAULT 'active',
        "isActive" boolean NOT NULL DEFAULT true,
        "passwordChangedAt" TIMESTAMP,
        "passwordRotationDays" integer NOT NULL DEFAULT 30,
        "passwordExpiresAt" TIMESTAMP,
        "passwordRecipientTelegramId" character varying,
        "lastLoginAt" TIMESTAMP,
        "lastLoginIp" character varying,
        "lastActivityAt" TIMESTAMP,
        "isTwoFactorEnabled" boolean NOT NULL DEFAULT false,
        "twoFactorSecret" character varying,
        "twoFactorBackupCodes" character varying,
        "twoFactorVerificationCode" character varying,
        "twoFactorVerificationExpires" TIMESTAMP,
        "description" text,
        "permissions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admins_username" UNIQUE ("username"),
        CONSTRAINT "UQ_admins_telegramId" UNIQUE ("telegramId"),
        CONSTRAINT "PK_admins" PRIMARY KEY ("id")
      )
    `);

    // Создаем enum для типов действий админа
    await queryRunner.query(`
      CREATE TYPE "admin_action_type_enum" AS ENUM (
        'login', 'logout', 'login_failed', 'password_changed',
        'two_factor_enabled', 'two_factor_disabled',
        'user_view', 'user_list', 'user_update', 'user_delete', 'user_block', 'user_unblock',
        'bot_view', 'bot_list', 'bot_update', 'bot_delete', 'bot_flow_update',
        'shop_view', 'shop_list', 'shop_update', 'shop_delete',
        'order_view', 'order_list', 'order_update', 'order_cancel',
        'product_view', 'product_list', 'product_update', 'product_delete',
        'lead_view', 'lead_list', 'lead_update', 'lead_delete',
        'message_view', 'message_list',
        'subscription_view', 'subscription_list', 'subscription_update',
        'admin_create', 'admin_update', 'admin_delete', 'admin_password_reset',
        'system_settings_view', 'system_settings_update', 'system_logs_view',
        'booking_view', 'booking_list', 'booking_update', 'booking_cancel',
        'custom_page_view', 'custom_page_list', 'custom_page_update', 'custom_page_delete'
      )
    `);

    // Создаем enum для уровней действий
    await queryRunner.query(`
      CREATE TYPE "admin_action_level_enum" AS ENUM ('info', 'warning', 'critical')
    `);

    // Создаем таблицу admin_action_logs
    await queryRunner.query(`
      CREATE TABLE "admin_action_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "adminId" uuid,
        "actionType" "admin_action_type_enum" NOT NULL,
        "level" "admin_action_level_enum" NOT NULL DEFAULT 'info',
        "description" text NOT NULL,
        "entityType" character varying,
        "entityId" character varying,
        "previousData" jsonb,
        "newData" jsonb,
        "metadata" jsonb,
        "ipAddress" character varying,
        "userAgent" character varying,
        "requestUrl" character varying,
        "requestMethod" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_action_logs" PRIMARY KEY ("id")
      )
    `);

    // Добавляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "admin_action_logs" 
      ADD CONSTRAINT "FK_admin_action_logs_admin" 
      FOREIGN KEY ("adminId") REFERENCES "admins"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Создаем индексы для admin_action_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_admin_action_logs_adminId_createdAt" 
      ON "admin_action_logs" ("adminId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_action_logs_actionType_createdAt" 
      ON "admin_action_logs" ("actionType", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_admin_action_logs_entityType_entityId" 
      ON "admin_action_logs" ("entityType", "entityId")
    `);

    // Создаем индекс на telegramId для быстрого поиска
    await queryRunner.query(`
      CREATE INDEX "IDX_admins_telegramId" ON "admins" ("telegramId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.query(`DROP INDEX "IDX_admins_telegramId"`);
    await queryRunner.query(
      `DROP INDEX "IDX_admin_action_logs_entityType_entityId"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_admin_action_logs_actionType_createdAt"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_admin_action_logs_adminId_createdAt"`
    );

    // Удаляем внешний ключ
    await queryRunner.query(`
      ALTER TABLE "admin_action_logs" DROP CONSTRAINT "FK_admin_action_logs_admin"
    `);

    // Удаляем таблицы
    await queryRunner.query(`DROP TABLE "admin_action_logs"`);
    await queryRunner.query(`DROP TABLE "admins"`);

    // Удаляем enum'ы
    await queryRunner.query(`DROP TYPE "admin_action_level_enum"`);
    await queryRunner.query(`DROP TYPE "admin_action_type_enum"`);
    await queryRunner.query(`DROP TYPE "admin_status_enum"`);
    await queryRunner.query(`DROP TYPE "admin_role_enum"`);
  }
}

