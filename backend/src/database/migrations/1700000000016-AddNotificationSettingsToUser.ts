import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNotificationSettingsToUser1700000000016
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "notificationSettings",
        type: "jsonb",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "notificationSettings");
  }
}

