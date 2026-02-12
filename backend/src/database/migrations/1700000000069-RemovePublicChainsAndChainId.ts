import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Удаление явных цепочек (public_chains, chainId).
 * Цепочка теперь вычисляется автоматически по связям сущностей.
 */
export class RemovePublicChainsAndChainId1700000000069
  implements MigrationInterface
{
  name = "RemovePublicChainsAndChainId1700000000069";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bots" DROP CONSTRAINT IF EXISTS "FK_bots_chain"`,
    );
    await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN IF EXISTS "chainId"`);

    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP CONSTRAINT IF EXISTS "FK_custom_pages_chain"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_pages" DROP COLUMN IF EXISTS "chainId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking_systems" DROP CONSTRAINT IF EXISTS "FK_booking_systems_chain"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_systems" DROP COLUMN IF EXISTS "chainId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "shops" DROP CONSTRAINT IF EXISTS "FK_shops_chain"`,
    );
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN IF EXISTS "chainId"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "public_chains"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(`ALTER TABLE "shops" ADD "chainId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "shops" ADD CONSTRAINT "FK_shops_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking_systems" ADD "chainId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_systems" ADD CONSTRAINT "FK_booking_systems_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`ALTER TABLE "custom_pages" ADD "chainId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "custom_pages" ADD CONSTRAINT "FK_custom_pages_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`ALTER TABLE "bots" ADD "chainId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "bots" ADD CONSTRAINT "FK_bots_chain" FOREIGN KEY ("chainId") REFERENCES "public_chains"("id") ON DELETE SET NULL`,
    );
  }
}
