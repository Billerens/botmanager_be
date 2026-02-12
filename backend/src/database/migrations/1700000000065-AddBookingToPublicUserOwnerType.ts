import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingToPublicUserOwnerType1700000000065
  implements MigrationInterface
{
  name = "AddBookingToPublicUserOwnerType1700000000065";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public_user_owner_type_enum" ADD VALUE 'booking'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не позволяет удалить значение из enum без пересоздания типа.
    // Оставляем значение в enum — откат только документирует ограничение.
  }
}
