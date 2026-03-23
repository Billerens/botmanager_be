import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAiProvidersTable1700000000079 implements MigrationInterface {
  name = "CreateAiProvidersTable1700000000079";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."ai_providers_providertype_enum" AS ENUM(
        'openai',
        'openrouter',
        'anthropic',
        'google',
        'ollama',
        'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_providers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "providerType" "public"."ai_providers_providertype_enum" NOT NULL DEFAULT 'custom',
        "description" character varying,
        "baseUrl" character varying,
        "apiKey" character varying,
        "defaultModel" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_providers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_providers_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_providers_userId" ON "ai_providers" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ai_providers_userId"`);
    await queryRunner.query(`DROP TABLE "ai_providers"`);
    await queryRunner.query(`DROP TYPE "public"."ai_providers_providertype_enum"`);
  }
}
