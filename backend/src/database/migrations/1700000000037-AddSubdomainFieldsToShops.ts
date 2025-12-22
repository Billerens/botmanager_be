import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubdomainFieldsToShops1700000000037
  implements MigrationInterface
{
  name = "AddSubdomainFieldsToShops1700000000037";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum для статуса субдомена
    await queryRunner.query(`
      CREATE TYPE "subdomain_status_enum" AS ENUM (
        'pending',
        'dns_creating',
        'ssl_issuing',
        'active',
        'dns_error',
        'ssl_error',
        'removing'
      )
    `);

    // Добавляем поля субдомена в таблицу shops
    await queryRunner.query(`
      ALTER TABLE "shops"
      ADD COLUMN "subdomainStatus" "subdomain_status_enum" DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "shops"
      ADD COLUMN "subdomainError" VARCHAR DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "shops"
      ADD COLUMN "subdomainActivatedAt" TIMESTAMP DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "shops"
      ADD COLUMN "subdomainUrl" VARCHAR DEFAULT NULL
    `);

    // Создаём индекс для быстрого поиска по статусу
    await queryRunner.query(`
      CREATE INDEX "IDX_shops_subdomain_status" ON "shops" ("subdomainStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индекс
    await queryRunner.query(`DROP INDEX "IDX_shops_subdomain_status"`);

    // Удаляем колонки
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "subdomainUrl"`);
    await queryRunner.query(
      `ALTER TABLE "shops" DROP COLUMN "subdomainActivatedAt"`
    );
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "subdomainError"`);
    await queryRunner.query(
      `ALTER TABLE "shops" DROP COLUMN "subdomainStatus"`
    );

    // Удаляем enum
    await queryRunner.query(`DROP TYPE "subdomain_status_enum"`);
  }
}

