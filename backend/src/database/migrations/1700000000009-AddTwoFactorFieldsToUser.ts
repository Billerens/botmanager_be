import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTwoFactorFieldsToUser1700000000009
  implements MigrationInterface
{
  name = "AddTwoFactorFieldsToUser1700000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем поля для двухфакторной аутентификации
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "isTwoFactorEnabled",
        type: "boolean",
        default: false,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "twoFactorType",
        type: "enum",
        enum: ["telegram", "google_authenticator"],
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "twoFactorSecret",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "twoFactorBackupCodes",
        type: "text",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "twoFactorVerificationCode",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "twoFactorVerificationExpires",
        type: "timestamp",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем поля двухфакторной аутентификации
    await queryRunner.dropColumn("users", "twoFactorVerificationExpires");
    await queryRunner.dropColumn("users", "twoFactorVerificationCode");
    await queryRunner.dropColumn("users", "twoFactorBackupCodes");
    await queryRunner.dropColumn("users", "twoFactorSecret");
    await queryRunner.dropColumn("users", "twoFactorType");
    await queryRunner.dropColumn("users", "isTwoFactorEnabled");
  }
}
