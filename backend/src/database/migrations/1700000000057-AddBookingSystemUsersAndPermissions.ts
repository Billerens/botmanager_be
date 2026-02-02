import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Модель прав системы бронирования: booking_system_users, booking_system_user_permissions, booking_system_invitations.
 */
export class AddBookingSystemUsersAndPermissions1700000000057
  implements MigrationInterface
{
  name = "AddBookingSystemUsersAndPermissions1700000000057";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE booking_system_user_permissions_entity_enum AS ENUM (
        'booking_settings', 'specialists', 'services', 'bookings', 'booking_system_users'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE booking_system_user_permissions_action_enum AS ENUM (
        'read', 'create', 'update', 'delete'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE booking_system_invitations_status_enum AS ENUM (
        'pending', 'accepted', 'declined', 'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "booking_system_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingSystemId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "displayName" character varying,
        "permissions" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_system_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_system_users_booking_user" UNIQUE ("bookingSystemId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "booking_system_user_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingSystemId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "entity" booking_system_user_permissions_entity_enum NOT NULL,
        "action" booking_system_user_permissions_action_enum NOT NULL,
        "granted" boolean NOT NULL DEFAULT false,
        "grantedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_system_user_permissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_system_user_permissions_unique" UNIQUE ("bookingSystemId", "userId", "entity", "action")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "booking_system_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingSystemId" uuid NOT NULL,
        "invitedTelegramId" character varying NOT NULL,
        "invitedUserId" uuid,
        "status" booking_system_invitations_status_enum NOT NULL DEFAULT 'pending',
        "permissions" jsonb NOT NULL,
        "invitedByUserId" uuid NOT NULL,
        "invitationToken" character varying,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_system_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_system_invitations_token" UNIQUE ("invitationToken")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_users_booking_system_id" ON "booking_system_users" ("bookingSystemId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_users_user_id" ON "booking_system_users" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_user_permissions_booking_system_id" ON "booking_system_user_permissions" ("bookingSystemId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_user_permissions_user_id" ON "booking_system_user_permissions" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_invitations_booking_system_id" ON "booking_system_invitations" ("bookingSystemId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_invitations_invited_telegram_id" ON "booking_system_invitations" ("invitedTelegramId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_system_invitations_status" ON "booking_system_invitations" ("status")
    `);

    await queryRunner.query(`
      ALTER TABLE "booking_system_users"
      ADD CONSTRAINT "FK_booking_system_users_booking_system_id" FOREIGN KEY ("bookingSystemId") REFERENCES "booking_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_booking_system_users_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_system_user_permissions"
      ADD CONSTRAINT "FK_booking_system_user_permissions_booking_system_id" FOREIGN KEY ("bookingSystemId") REFERENCES "booking_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_booking_system_user_permissions_user_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_booking_system_user_permissions_granted_by" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_system_invitations"
      ADD CONSTRAINT "FK_booking_system_invitations_booking_system_id" FOREIGN KEY ("bookingSystemId") REFERENCES "booking_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_booking_system_invitations_invited_user_id" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT "FK_booking_system_invitations_invited_by" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_system_invitations" DROP CONSTRAINT "FK_booking_system_invitations_invited_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_invitations" DROP CONSTRAINT "FK_booking_system_invitations_invited_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_invitations" DROP CONSTRAINT "FK_booking_system_invitations_booking_system_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_user_permissions" DROP CONSTRAINT "FK_booking_system_user_permissions_granted_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_user_permissions" DROP CONSTRAINT "FK_booking_system_user_permissions_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_user_permissions" DROP CONSTRAINT "FK_booking_system_user_permissions_booking_system_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_users" DROP CONSTRAINT "FK_booking_system_users_user_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "booking_system_users" DROP CONSTRAINT "FK_booking_system_users_booking_system_id"`
    );

    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_invitations_status"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_invitations_invited_telegram_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_invitations_booking_system_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_user_permissions_user_id"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_user_permissions_booking_system_id"`
    );
    await queryRunner.query(`DROP INDEX "IDX_booking_system_users_user_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_booking_system_users_booking_system_id"`
    );

    await queryRunner.query(`DROP TABLE "booking_system_invitations"`);
    await queryRunner.query(`DROP TABLE "booking_system_user_permissions"`);
    await queryRunner.query(`DROP TABLE "booking_system_users"`);

    await queryRunner.query(`DROP TYPE booking_system_invitations_status_enum`);
    await queryRunner.query(
      `DROP TYPE booking_system_user_permissions_entity_enum`
    );
    await queryRunner.query(
      `DROP TYPE booking_system_user_permissions_action_enum`
    );
  }
}
