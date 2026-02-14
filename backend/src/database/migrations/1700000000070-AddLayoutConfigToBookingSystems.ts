import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Добавляет колонку layoutConfig в booking_systems для хранения конфигурации
 * макета страниц модульного редактора (по аналогии с Shop).
 */
export class AddLayoutConfigToBookingSystems1700000000070
  implements MigrationInterface
{
  name = "AddLayoutConfigToBookingSystems1700000000070";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_systems" ADD "layoutConfig" json`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking_systems" DROP COLUMN "layoutConfig"`,
    );
  }
}
