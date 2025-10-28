import { MigrationInterface, QueryRunner } from "typeorm";

export class FixBookingTimeSlotRelation1700000000015
  implements MigrationInterface
{
  name = "FixBookingTimeSlotRelation1700000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем unique constraint на timeSlotId в таблице bookings
    // Это позволит иметь несколько бронирований (включая отмененные) на один слот
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "UQ_fb0e0598f0c94a35c9751520bbf"`
    );

    // Также удаляем любые другие unique constraints на timeSlotId
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "REL_8dca9e0b4b1f3e5b0a0b0a0b0a"`
    );

    // Проверяем и удаляем unique index если существует
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fb0e0598f0c94a35c9751520bbf"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // В rollback НЕ восстанавливаем unique constraint
    // потому что это была ошибка в дизайне - один слот может иметь несколько бронирований
    // (активное + отмененные в истории)
    // Если все же нужно вернуть (не рекомендуется):
    // await queryRunner.query(
    //   `ALTER TABLE "bookings" ADD CONSTRAINT "UQ_fb0e0598f0c94a35c9751520bbf" UNIQUE ("timeSlotId")`
    // );
  }
}
