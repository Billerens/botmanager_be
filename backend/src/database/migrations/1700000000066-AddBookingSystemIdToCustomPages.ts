import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingSystemIdToCustomPages1700000000066
  implements MigrationInterface
{
  name = "AddBookingSystemIdToCustomPages1700000000066";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD COLUMN "bookingSystemId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      ADD CONSTRAINT "FK_custom_pages_bookingSystemId"
      FOREIGN KEY ("bookingSystemId")
      REFERENCES "booking_systems"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      DROP CONSTRAINT IF EXISTS "FK_custom_pages_bookingSystemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_pages"
      DROP COLUMN IF EXISTS "bookingSystemId"
    `);
  }
}
