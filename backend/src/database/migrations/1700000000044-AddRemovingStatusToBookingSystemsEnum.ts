import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRemovingStatusToBookingSystemsEnum1700000000044
  implements MigrationInterface
{
  name = "AddRemovingStatusToBookingSystemsEnum1700000000044";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем значение 'removing' в enum booking_systems_subdomainstatus_enum
    // PostgreSQL позволяет добавлять новые значения в enum через ALTER TYPE
    await queryRunner.query(`
      ALTER TYPE "booking_systems_subdomainstatus_enum" ADD VALUE IF NOT EXISTS 'removing'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не поддерживает удаление значений из enum напрямую
    // Для отката потребуется пересоздание типа, что сложно
    // Оставляем пустым, так как значение 'removing' не вредит если не используется
    console.log(
      "Warning: Cannot remove enum value in PostgreSQL without recreating the type"
    );
  }
}
