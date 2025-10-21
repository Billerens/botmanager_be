import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTelegramIdNullValues1700000000008
  implements MigrationInterface
{
  name = "FixTelegramIdNullValues1700000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Сначала обновляем все null значения в telegramId на временные значения
    await queryRunner.query(`
      UPDATE "users" 
      SET "telegramId" = 'temp_' || "id" 
      WHERE "telegramId" IS NULL
    `);

    // Теперь можем безопасно изменить колонку на NOT NULL
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "telegramId" SET NOT NULL
    `);

    // Удаляем старые email поля если они еще существуют
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "isEmailVerified"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationCode"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationExpires"`
    );

    // Проверяем и добавляем недостающие telegram поля
    const telegramUsernameExists = await queryRunner.hasColumn(
      "users",
      "telegramUsername"
    );
    if (!telegramUsernameExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "telegramUsername" character varying`
      );
    }

    const isTelegramVerifiedExists = await queryRunner.hasColumn(
      "users",
      "isTelegramVerified"
    );
    if (!isTelegramVerifiedExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "isTelegramVerified" boolean NOT NULL DEFAULT false`
      );
    }

    const telegramVerificationCodeExists = await queryRunner.hasColumn(
      "users",
      "telegramVerificationCode"
    );
    if (!telegramVerificationCodeExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "telegramVerificationCode" character varying`
      );
    }

    const telegramVerificationExpiresExists = await queryRunner.hasColumn(
      "users",
      "telegramVerificationExpires"
    );
    if (!telegramVerificationExpiresExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "telegramVerificationExpires" TIMESTAMP`
      );
    }

    // Создаем уникальный индекс для telegramId только если он не существует
    const telegramIndexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' AND indexname = 'IDX_users_telegram_id'
      )
    `);

    if (!telegramIndexExists[0].exists) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_users_telegram_id" ON "users" ("telegramId")`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индекс
    const telegramIndexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' AND indexname = 'IDX_users_telegram_id'
      )
    `);

    if (telegramIndexExists[0].exists) {
      await queryRunner.query(`DROP INDEX "IDX_users_telegram_id"`);
    }

    // Удаляем telegram поля
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramVerificationExpires"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramVerificationCode"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "isTelegramVerified"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramUsername"`
    );

    // Делаем telegramId nullable
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "telegramId" DROP NOT NULL
    `);

    // Восстанавливаем email поля
    const emailExists = await queryRunner.hasColumn("users", "email");
    if (!emailExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "email" character varying`
      );
    }

    const isEmailVerifiedExists = await queryRunner.hasColumn(
      "users",
      "isEmailVerified"
    );
    if (!isEmailVerifiedExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`
      );
    }

    const emailVerificationTokenExists = await queryRunner.hasColumn(
      "users",
      "emailVerificationToken"
    );
    if (!emailVerificationTokenExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "emailVerificationToken" character varying`
      );
    }

    const emailVerificationCodeExists = await queryRunner.hasColumn(
      "users",
      "emailVerificationCode"
    );
    if (!emailVerificationCodeExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "emailVerificationCode" character varying`
      );
    }

    const emailVerificationExpiresExists = await queryRunner.hasColumn(
      "users",
      "emailVerificationExpires"
    );
    if (!emailVerificationExpiresExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "emailVerificationExpires" TIMESTAMP`
      );
    }

    // Создаем индекс для email
    const emailIndexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' AND indexname = 'IDX_users_email'
      )
    `);

    if (!emailIndexExists[0].exists) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`
      );
    }
  }
}
