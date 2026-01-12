import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCustomDomainsToARecord1700000000050
  implements MigrationInterface
{
  name = "UpdateCustomDomainsToARecord1700000000050";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Переименовываем expectedCname в expectedIp
    await queryRunner.query(
      `ALTER TABLE "custom_domains" RENAME COLUMN "expectedCname" TO "expectedIp"`
    );

    // Изменяем тип и убираем значение по умолчанию
    await queryRunner.query(
      `ALTER TABLE "custom_domains" ALTER COLUMN "expectedIp" DROP DEFAULT`
    );

    // Обновляем существующие записи - очищаем старые CNAME значения
    await queryRunner.query(
      `UPDATE "custom_domains" SET "expectedIp" = NULL WHERE "expectedIp" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Возвращаем обратно
    await queryRunner.query(
      `ALTER TABLE "custom_domains" RENAME COLUMN "expectedIp" TO "expectedCname"`
    );

    await queryRunner.query(
      `ALTER TABLE "custom_domains" ALTER COLUMN "expectedCname" SET DEFAULT 'proxy.botmanagertest.online'`
    );
  }
}
