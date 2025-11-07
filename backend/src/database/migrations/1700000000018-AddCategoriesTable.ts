import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoriesTable1700000000018 implements MigrationInterface {
  name = "AddCategoriesTable1700000000018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу categories
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "imageUrl" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "parentId" uuid,
        "botId" uuid NOT NULL,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);

    // Добавляем внешний ключ для связи с родительской категорией
    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "FK_categories_parentId" 
      FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE
    `);

    // Добавляем внешний ключ для связи с ботом
    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "FK_categories_botId" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    // Создаем индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_categories_botId" ON "categories" ("botId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_categories_parentId" ON "categories" ("parentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_categories_isActive" ON "categories" ("isActive")
    `);

    // Добавляем колонку categoryId в таблицу products
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN "categoryId" uuid
    `);

    // Добавляем внешний ключ для связи products с categories
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD CONSTRAINT "FK_products_categoryId" 
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    // Создаем индекс для categoryId в products
    await queryRunner.query(`
      CREATE INDEX "IDX_products_categoryId" ON "products" ("categoryId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индекс и внешний ключ для products
    await queryRunner.query(`DROP INDEX "IDX_products_categoryId"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_categoryId"`
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "categoryId"`);

    // Удаляем индексы для categories
    await queryRunner.query(`DROP INDEX "IDX_categories_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_parentId"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_botId"`);

    // Удаляем внешние ключи для categories
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_botId"`
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parentId"`
    );

    // Удаляем таблицу categories
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
