import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class AddBotIdToPublicUsers1700000000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Добавляем колонку botId
    await queryRunner.addColumn(
      "public_users",
      new TableColumn({
        name: "botId",
        type: "uuid",
        isNullable: true, // Сначала nullable, потом сделаем NOT NULL
      })
    );

    // 2. Удаляем старые индексы
    try {
      await queryRunner.dropIndex("public_users", "IDX_public_users_email");
    } catch (e) {
      // Индекс может не существовать
    }

    // 3. Удаляем уникальность с email
    // В PostgreSQL нужно явно удалить constraint
    try {
      await queryRunner.query(
        `ALTER TABLE "public_users" DROP CONSTRAINT IF EXISTS "UQ_public_users_email"`
      );
    } catch (e) {
      // Constraint может не существовать
    }

    // 4. Удаляем старых пользователей без botId (если есть)
    // В production это может быть опасно, но для теста это нормально
    await queryRunner.query(
      `DELETE FROM "public_users" WHERE "botId" IS NULL`
    );

    // 5. Делаем botId NOT NULL
    await queryRunner.changeColumn(
      "public_users",
      "botId",
      new TableColumn({
        name: "botId",
        type: "uuid",
        isNullable: false,
      })
    );

    // 6. Создаём внешний ключ на bots
    await queryRunner.createForeignKey(
      "public_users",
      new TableForeignKey({
        name: "FK_public_users_botId",
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );

    // 7. Создаём составной уникальный индекс [email, botId]
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_email_botId",
        columnNames: ["email", "botId"],
        isUnique: true,
      })
    );

    // 8. Создаём индекс по botId
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_botId",
        columnNames: ["botId"],
      })
    );

    // 9. Создаём индекс для поиска по telegramId в рамках бота
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_botId_telegramId",
        columnNames: ["botId", "telegramId"],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.dropIndex(
      "public_users",
      "IDX_public_users_botId_telegramId"
    );
    await queryRunner.dropIndex("public_users", "IDX_public_users_botId");
    await queryRunner.dropIndex("public_users", "IDX_public_users_email_botId");

    // Удаляем внешний ключ
    await queryRunner.dropForeignKey("public_users", "FK_public_users_botId");

    // Удаляем колонку botId
    await queryRunner.dropColumn("public_users", "botId");

    // Восстанавливаем уникальный индекс по email
    await queryRunner.createIndex(
      "public_users",
      new TableIndex({
        name: "IDX_public_users_email",
        columnNames: ["email"],
        isUnique: true,
      })
    );
  }
}

