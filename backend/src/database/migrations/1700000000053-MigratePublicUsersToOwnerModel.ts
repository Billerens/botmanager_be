import { MigrationInterface, QueryRunner } from "typeorm";

export class MigratePublicUsersToOwnerModel1700000000053 implements MigrationInterface {
  name = "MigratePublicUsersToOwnerModel1700000000053";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // 1. Создаём enum тип для PublicUserOwnerType
    // ========================================================================
    await queryRunner.query(`
      CREATE TYPE "public_user_owner_type_enum" AS ENUM ('user', 'bot', 'shop')
    `);

    // ========================================================================
    // 2. Добавляем новые колонки ownerId и ownerType
    // ========================================================================
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD COLUMN "ownerId" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD COLUMN "ownerType" "public_user_owner_type_enum" DEFAULT 'shop'
    `);

    // ========================================================================
    // 3. Мигрируем данные из shopId в ownerId
    // ========================================================================
    await queryRunner.query(`
      UPDATE "public_users" 
      SET "ownerId" = "shopId", "ownerType" = 'shop'
      WHERE "shopId" IS NOT NULL
    `);

    // ========================================================================
    // 4. Делаем ownerId NOT NULL (после миграции данных)
    // ========================================================================
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ALTER COLUMN "ownerId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ALTER COLUMN "ownerType" SET NOT NULL
    `);

    // ========================================================================
    // 5. Удаляем старые индексы
    // ========================================================================
    // Проверяем и удаляем индексы если они существуют
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_email_shopId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_shopId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_shopId_telegramId"
    `);

    // ========================================================================
    // 6. Создаём новые индексы
    // ========================================================================
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_public_users_email_ownerId_ownerType" 
      ON "public_users" ("email", "ownerId", "ownerType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_public_users_ownerId_ownerType" 
      ON "public_users" ("ownerId", "ownerType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_public_users_ownerId_ownerType_telegramId" 
      ON "public_users" ("ownerId", "ownerType", "telegramId")
    `);

    // ========================================================================
    // 7. Удаляем foreign key и колонку shopId
    // ========================================================================
    // Удаляем foreign key constraint если существует
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP CONSTRAINT IF EXISTS "FK_public_users_shopId"
    `);

    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP COLUMN IF EXISTS "shopId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // Откат: восстанавливаем старую структуру
    // ========================================================================

    // 1. Добавляем колонку shopId обратно
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD COLUMN "shopId" uuid
    `);

    // 2. Мигрируем данные обратно (только для shop type)
    await queryRunner.query(`
      UPDATE "public_users" 
      SET "shopId" = "ownerId"::uuid
      WHERE "ownerType" = 'shop'
    `);

    // 3. Удаляем новые индексы
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_email_ownerId_ownerType"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_ownerId_ownerType"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_public_users_ownerId_ownerType_telegramId"
    `);

    // 4. Удаляем новые колонки
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP COLUMN IF EXISTS "ownerId"
    `);

    await queryRunner.query(`
      ALTER TABLE "public_users" 
      DROP COLUMN IF EXISTS "ownerType"
    `);

    // 5. Удаляем enum тип
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public_user_owner_type_enum"
    `);

    // 6. Восстанавливаем старые индексы
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_public_users_email_shopId" 
      ON "public_users" ("email", "shopId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_public_users_shopId" 
      ON "public_users" ("shopId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_public_users_shopId_telegramId" 
      ON "public_users" ("shopId", "telegramId")
    `);

    // 7. Восстанавливаем foreign key
    await queryRunner.query(`
      ALTER TABLE "public_users" 
      ADD CONSTRAINT "FK_public_users_shopId" 
      FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE
    `);
  }
}
