import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Модель прав магазина: shop_users, shop_user_permissions, shop_invitations.
 * Действия (read/create/update/delete) переиспользуем из bot_user_permissions_action_enum.
 */
export class AddShopUsersAndPermissions1700000000056
  implements MigrationInterface
{
  name = "AddShopUsersAndPermissions1700000000056";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum сущностей магазина
    await queryRunner.query(`
      CREATE TYPE shop_user_permissions_entity_enum AS ENUM (
        'shop_settings', 'products', 'categories', 'orders', 'carts', 'promocodes', 'shop_users'
      )
    `);

    // Enum действий (те же значения, что у бота — для совместимости с TypeORM)
    await queryRunner.query(`
      CREATE TYPE shop_user_permissions_action_enum AS ENUM (
        'read', 'create', 'update', 'delete'
      )
    `);

    // Enum статуса приглашений магазина (те же значения, что у бота)
    await queryRunner.query(`
      CREATE TYPE shop_invitations_status_enum AS ENUM (
        'pending', 'accepted', 'declined', 'expired'
      )
    `);

    // Таблица shop_users
    await queryRunner.query(`
      CREATE TABLE "shop_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shopId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "displayName" character varying,
        "permissions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shop_users_shop_user" UNIQUE ("shopId", "userId")
      )
    `);

    // Таблица shop_user_permissions
    await queryRunner.query(`
      CREATE TABLE "shop_user_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shopId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "entity" shop_user_permissions_entity_enum NOT NULL,
        "action" shop_user_permissions_action_enum NOT NULL,
        "granted" boolean NOT NULL DEFAULT false,
        "grantedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_user_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shop_user_permissions_unique" UNIQUE ("shopId", "userId", "entity", "action")
      )
    `);

    // Таблица shop_invitations
    await queryRunner.query(`
      CREATE TABLE "shop_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shopId" uuid NOT NULL,
        "invitedTelegramId" character varying NOT NULL,
        "invitedUserId" uuid,
        "status" shop_invitations_status_enum NOT NULL DEFAULT 'pending',
        "permissions" jsonb NOT NULL,
        "invitedByUserId" uuid NOT NULL,
        "invitationToken" character varying,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shop_invitations_token" UNIQUE ("invitationToken")
      )
    `);

    // Индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_users_shop_id" ON "shop_users" ("shopId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_users_user_id" ON "shop_users" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_user_permissions_shop_id" ON "shop_user_permissions" ("shopId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_user_permissions_user_id" ON "shop_user_permissions" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_invitations_shop_id" ON "shop_invitations" ("shopId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_invitations_invited_telegram_id" ON "shop_invitations" ("invitedTelegramId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_shop_invitations_status" ON "shop_invitations" ("status")
    `);

    // Внешние ключи
    await queryRunner.query(`
      ALTER TABLE "shop_users"
      ADD CONSTRAINT "FK_shop_users_shop_id" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_shop_users_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "shop_user_permissions"
      ADD CONSTRAINT "FK_shop_user_permissions_shop_id" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_shop_user_permissions_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_shop_user_permissions_granted_by" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "shop_invitations"
      ADD CONSTRAINT "FK_shop_invitations_shop_id" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_shop_invitations_invited_user_id" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_shop_invitations_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shop_invitations" DROP CONSTRAINT "FK_shop_invitations_invited_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_invitations" DROP CONSTRAINT "FK_shop_invitations_invited_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_invitations" DROP CONSTRAINT "FK_shop_invitations_shop_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_user_permissions" DROP CONSTRAINT "FK_shop_user_permissions_granted_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_user_permissions" DROP CONSTRAINT "FK_shop_user_permissions_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_user_permissions" DROP CONSTRAINT "FK_shop_user_permissions_shop_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_users" DROP CONSTRAINT "FK_shop_users_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "shop_users" DROP CONSTRAINT "FK_shop_users_shop_id"`
    );

    await queryRunner.query(`DROP INDEX "IDX_shop_invitations_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_shop_invitations_invited_telegram_id"`
    );
    await queryRunner.query(`DROP INDEX "IDX_shop_invitations_shop_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shop_user_permissions_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shop_user_permissions_shop_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shop_users_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shop_users_shop_id"`);

    await queryRunner.query(`DROP TABLE "shop_invitations"`);
    await queryRunner.query(`DROP TABLE "shop_user_permissions"`);
    await queryRunner.query(`DROP TABLE "shop_users"`);

    await queryRunner.query(`DROP TYPE shop_invitations_status_enum`);
    await queryRunner.query(`DROP TYPE shop_user_permissions_entity_enum`);
    await queryRunner.query(`DROP TYPE shop_user_permissions_action_enum`);
  }
}
