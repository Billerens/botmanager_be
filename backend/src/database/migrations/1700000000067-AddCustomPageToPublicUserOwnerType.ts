import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomPageToPublicUserOwnerType1700000000067
  implements MigrationInterface
{
  name = "AddCustomPageToPublicUserOwnerType1700000000067";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public_user_owner_type_enum" ADD VALUE 'custom_page'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL не позволяет удалить значение из enum без пересоздания типа.
    // Откат только документирует ограничение.
  }
}
