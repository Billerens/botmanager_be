import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicChainsAndChainId1700000000068
  implements MigrationInterface
{
  name = "AddPublicChainsAndChainId1700000000068";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public_chains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "ownerId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_public_chains" PRIMARY KEY ("id"),
        CONSTRAINT "FK_public_chains_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_public_chains_ownerId" ON "public_chains" ("ownerId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "shops" ADD "chainId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "shops" ADD CONSTRAINT "FK_shops_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking_systems" ADD "chainId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_systems" ADD CONSTRAINT "FK_booking_systems_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "custom_pages" ADD "chainId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" ADD CONSTRAINT "FK_custom_pages_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "bots" ADD "chainId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "bots" ADD CONSTRAINT "FK_bots_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      ALTER TYPE "public_user_owner_type_enum" ADD VALUE 'chain'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bots" DROP CONSTRAINT "FK_bots_chain"`,
    );
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "chainId"`);

    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP CONSTRAINT "FK_custom_pages_chain"`,
    );
    await queryRunner.query(`ALTER TABLE "custom_pages" DROP COLUMN "chainId"`);

    await queryRunner.query(
      `ALTER TABLE "booking_systems" DROP CONSTRAINT "FK_booking_systems_chain"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_systems" DROP COLUMN "chainId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "shops" DROP CONSTRAINT "FK_shops_chain"`,
    );
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "chainId"`);

    await queryRunner.query(`DROP TABLE "public_chains"`);
    // PostgreSQL не позволяет удалить значение enum без пересоздания типа
  }
}
