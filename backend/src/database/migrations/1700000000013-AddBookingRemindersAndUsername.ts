import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingRemindersAndUsername1700000000013
  implements MigrationInterface
{
  name = "AddBookingRemindersAndUsername1700000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поле telegramUsername
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD COLUMN "telegramUsername" character varying
    `);

    // Добавляем поле reminders
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD COLUMN "reminders" jsonb
    `);

    console.log("Migration: Added telegramUsername and reminders fields to bookings table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем поле reminders
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      DROP COLUMN "reminders"
    `);

    // Удаляем поле telegramUsername
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      DROP COLUMN "telegramUsername"
    `);

    console.log("Migration: Removed telegramUsername and reminders fields from bookings table");
  }
}

