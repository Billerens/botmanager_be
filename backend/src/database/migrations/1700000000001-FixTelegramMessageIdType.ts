import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTelegramMessageIdType1700000000001
  implements MigrationInterface
{
  name = "FixTelegramMessageIdType1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "telegramMessageId"`
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "telegramMessageId" bigint NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "telegramMessageId"`
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "telegramMessageId" integer NOT NULL`
    );
  }
}
