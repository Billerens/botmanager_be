import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductsTable1700000000002 implements MigrationInterface {
  name = "AddProductsTable1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'RUB',
        "stockQuantity" integer NOT NULL DEFAULT '0',
        "images" json,
        "parameters" json,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "botId" uuid NOT NULL,
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD CONSTRAINT "FK_products_botId" 
      FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_botId" ON "products" ("botId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_isActive" ON "products" ("isActive")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_products_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_products_botId"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_botId"`
    );
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
