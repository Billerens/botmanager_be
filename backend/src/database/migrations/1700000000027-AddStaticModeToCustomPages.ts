import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaticModeToCustomPages1700000000027
  implements MigrationInterface
{
  name = "AddStaticModeToCustomPages1700000000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum для типа страницы
    await queryRunner.query(`
      CREATE TYPE "custom_page_type_enum" AS ENUM ('inline', 'static')
    `);

    // Добавляем новые поля
    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ADD COLUMN "pageType" "custom_page_type_enum" NOT NULL DEFAULT 'inline'
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ADD COLUMN "staticPath" text
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ADD COLUMN "entryPoint" varchar NOT NULL DEFAULT 'index.html'
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ADD COLUMN "assets" text
    `);

    // Делаем content nullable для static режима
    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ALTER COLUMN "content" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем новые поля
    await queryRunner.query(`
      ALTER TABLE "custom_pages" DROP COLUMN "assets"
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" DROP COLUMN "entryPoint"
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" DROP COLUMN "staticPath"
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_pages" DROP COLUMN "pageType"
    `);

    // Удаляем enum
    await queryRunner.query(`
      DROP TYPE "custom_page_type_enum"
    `);

    // Возвращаем NOT NULL для content
    await queryRunner.query(`
      ALTER TABLE "custom_pages" 
      ALTER COLUMN "content" SET NOT NULL
    `);
  }
}

