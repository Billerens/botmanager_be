import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEmailVerificationCodeFields1700000000006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("users", [
      new TableColumn({
        name: "emailVerificationCode",
        type: "varchar",
        isNullable: true,
      }),
      new TableColumn({
        name: "emailVerificationExpires",
        type: "timestamp",
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("users", [
      "emailVerificationCode",
      "emailVerificationExpires",
    ]);
  }
}

