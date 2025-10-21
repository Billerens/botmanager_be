import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceEmailWithTelegram1700000000007
  implements MigrationInterface
{
  name = "ReplaceEmailWithTelegram1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Удаляем старые email поля
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

    // Добавляем новые telegram поля
    await queryRunner.query(
      `ALTER TABLE "users" ADD "telegramId" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "telegramUsername" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isTelegramVerified" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "telegramVerificationCode" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "telegramVerificationExpires" TIMESTAMP`
    );

    // Создаем уникальный индекс для telegramId
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_telegram_id" ON "users" ("telegramId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем новые telegram поля
    await queryRunner.query(`DROP INDEX "IDX_users_telegram_id"`);
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
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramId"`
    );

    // Восстанавливаем старые email поля
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationToken" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationCode" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationExpires" TIMESTAMP`
    );

    // Создаем уникальный индекс для email
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`
    );
  }
}
