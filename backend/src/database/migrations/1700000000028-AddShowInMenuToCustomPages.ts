import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShowInMenuToCustomPages1700000000028
  implements MigrationInterface
{
  name = "AddShowInMenuToCustomPages1700000000028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем колонку showInMenu в таблицу custom_pages
    // По умолчанию true, чтобы существующие записи сохранили прежнее поведение
    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ADD COLUMN IF NOT EXISTS "showInMenu" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем колонку showInMenu
    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      DROP COLUMN IF EXISTS "showInMenu"
    `);
  }
}
