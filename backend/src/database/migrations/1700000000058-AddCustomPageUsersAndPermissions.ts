import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Модель прав кастомной страницы: custom_page_users, custom_page_user_permissions, custom_page_invitations.
 */
export class AddCustomPageUsersAndPermissions1700000000058
  implements MigrationInterface
{
  name = "AddCustomPageUsersAndPermissions1700000000058";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE custom_page_user_permissions_entity_enum AS ENUM (
        'page', 'custom_page_users'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE custom_page_user_permissions_action_enum AS ENUM (
        'read', 'create', 'update', 'delete'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE custom_page_invitations_status_enum AS ENUM (
        'pending', 'accepted', 'declined', 'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "custom_page_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customPageId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "displayName" character varying,
        "permissions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_page_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_page_users_page_user" UNIQUE ("customPageId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "custom_page_user_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customPageId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "entity" custom_page_user_permissions_entity_enum NOT NULL,
        "action" custom_page_user_permissions_action_enum NOT NULL,
        "granted" boolean NOT NULL DEFAULT false,
        "grantedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_page_user_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_page_user_permissions_unique" UNIQUE ("customPageId", "userId", "entity", "action")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "custom_page_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customPageId" uuid NOT NULL,
        "invitedTelegramId" character varying NOT NULL,
        "invitedUserId" uuid,
        "status" custom_page_invitations_status_enum NOT NULL DEFAULT 'pending',
        "permissions" jsonb NOT NULL,
        "invitedByUserId" uuid NOT NULL,
        "invitationToken" character varying,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_page_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_page_invitations_token" UNIQUE ("invitationToken")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_users_custom_page_id" ON "custom_page_users" ("customPageId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_users_user_id" ON "custom_page_users" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_user_permissions_custom_page_id" ON "custom_page_user_permissions" ("customPageId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_user_permissions_user_id" ON "custom_page_user_permissions" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_invitations_custom_page_id" ON "custom_page_invitations" ("customPageId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_invitations_invited_telegram_id" ON "custom_page_invitations" ("invitedTelegramId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_custom_page_invitations_status" ON "custom_page_invitations" ("status")
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_page_users"
      ADD CONSTRAINT "FK_custom_page_users_custom_page_id" FOREIGN KEY ("customPageId") REFERENCES "custom_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_custom_page_users_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_page_user_permissions"
      ADD CONSTRAINT "FK_custom_page_user_permissions_custom_page_id" FOREIGN KEY ("customPageId") REFERENCES "custom_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_custom_page_user_permissions_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_custom_page_user_permissions_granted_by" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_page_invitations"
      ADD CONSTRAINT "FK_custom_page_invitations_custom_page_id" FOREIGN KEY ("customPageId") REFERENCES "custom_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_custom_page_invitations_invited_user_id" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_custom_page_invitations_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_page_invitations" DROP CONSTRAINT "FK_custom_page_invitations_invited_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_invitations" DROP CONSTRAINT "FK_custom_page_invitations_invited_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_invitations" DROP CONSTRAINT "FK_custom_page_invitations_custom_page_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_user_permissions" DROP CONSTRAINT "FK_custom_page_user_permissions_granted_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_user_permissions" DROP CONSTRAINT "FK_custom_page_user_permissions_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_user_permissions" DROP CONSTRAINT "FK_custom_page_user_permissions_custom_page_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_users" DROP CONSTRAINT "FK_custom_page_users_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "custom_page_users" DROP CONSTRAINT "FK_custom_page_users_custom_page_id"`
    );

    await queryRunner.query(`DROP INDEX "IDX_custom_page_invitations_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_custom_page_invitations_invited_telegram_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_custom_page_invitations_custom_page_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_custom_page_user_permissions_user_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_custom_page_user_permissions_custom_page_id"`
    );
    await queryRunner.query(`DROP INDEX "IDX_custom_page_users_user_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_custom_page_users_custom_page_id"`
    );

    await queryRunner.query(`DROP TABLE "custom_page_invitations"`);
    await queryRunner.query(`DROP TABLE "custom_page_user_permissions"`);
    await queryRunner.query(`DROP TABLE "custom_page_users"`);

    await queryRunner.query(`DROP TYPE custom_page_invitations_status_enum`);
    await queryRunner.query(
      `DROP TYPE custom_page_user_permissions_entity_enum`
    );
    await queryRunner.query(
      `DROP TYPE custom_page_user_permissions_action_enum`
    );
  }
}
