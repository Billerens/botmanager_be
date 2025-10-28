import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTimestampTimezones1700000000014 implements MigrationInterface {
  name = "FixTimestampTimezones1700000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Изменяем тип timestamp на timestamptz (с timezone) для корректной работы с UTC

    // time_slots
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "startTime" TYPE timestamptz USING "startTime" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "endTime" TYPE timestamptz USING "endTime" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'`
    );

    // bookings
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "confirmedAt" TYPE timestamptz USING "confirmedAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "cancelledAt" TYPE timestamptz USING "cancelledAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "confirmationCodeExpires" TYPE timestamptz USING "confirmationCodeExpires" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Возвращаем обратно на timestamp (без timezone)

    // time_slots
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "startTime" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "endTime" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "createdAt" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "time_slots" ALTER COLUMN "updatedAt" TYPE timestamp`
    );

    // bookings
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "confirmedAt" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "cancelledAt" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "confirmationCodeExpires" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "createdAt" TYPE timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "updatedAt" TYPE timestamp`
    );
  }
}
