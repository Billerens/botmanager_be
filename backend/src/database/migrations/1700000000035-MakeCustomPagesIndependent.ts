import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";

/**
 * Миграция для отвязки CustomPages от жёсткой привязки к Bot.
 *
 * Изменения:
 * 1. Добавляется ownerId (владелец страницы) - NOT NULL
 * 2. Добавляется shopId (опциональная привязка к магазину) - NULLABLE
 * 3. botId становится NULLABLE с onDelete: SET NULL
 * 4. slug становится NULLABLE (но уникальным если задан)
 * 5. Данные мигрируются из существующих связей
 */
export class MakeCustomPagesIndependent1700000000035
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. Удаляем старый foreign key для botId (с CASCADE)
    // ============================================================
    const table = await queryRunner.getTable("custom_pages");
    const botForeignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("botId") !== -1
    );
    if (botForeignKey) {
      await queryRunner.dropForeignKey("custom_pages", botForeignKey);
    }

    // ============================================================
    // 2. Добавляем колонку ownerId (временно nullable для миграции данных)
    // ============================================================
    await queryRunner.addColumn(
      "custom_pages",
      new TableColumn({
        name: "ownerId",
        type: "uuid",
        isNullable: true, // Временно nullable
      })
    );

    // ============================================================
    // 3. Добавляем колонку shopId
    // ============================================================
    await queryRunner.addColumn(
      "custom_pages",
      new TableColumn({
        name: "shopId",
        type: "uuid",
        isNullable: true,
      })
    );

    // ============================================================
    // 4. Заполняем ownerId из ботов
    // ============================================================
    await queryRunner.query(`
      UPDATE custom_pages cp
      SET "ownerId" = b."ownerId"
      FROM bots b
      WHERE cp."botId" = b.id
    `);

    // Проверяем, остались ли страницы без владельца (не должно быть)
    const orphanedPages = await queryRunner.query(`
      SELECT id FROM custom_pages WHERE "ownerId" IS NULL
    `);
    if (orphanedPages.length > 0) {
      console.warn(
        `Warning: Found ${orphanedPages.length} pages without owner. They will be deleted.`
      );
      await queryRunner.query(`
        DELETE FROM custom_pages WHERE "ownerId" IS NULL
      `);
    }

    // ============================================================
    // 5. Делаем ownerId NOT NULL
    // ============================================================
    await queryRunner.changeColumn(
      "custom_pages",
      "ownerId",
      new TableColumn({
        name: "ownerId",
        type: "uuid",
        isNullable: false,
      })
    );

    // ============================================================
    // 6. Заполняем shopId для страниц, чьи боты привязаны к магазинам
    // ============================================================
    await queryRunner.query(`
      UPDATE custom_pages cp
      SET "shopId" = s.id
      FROM shops s
      WHERE cp."botId" = s."botId"
        AND s."botId" IS NOT NULL
    `);

    // ============================================================
    // 7. Делаем botId nullable
    // ============================================================
    await queryRunner.changeColumn(
      "custom_pages",
      "botId",
      new TableColumn({
        name: "botId",
        type: "uuid",
        isNullable: true,
      })
    );

    // ============================================================
    // 8. Делаем slug nullable (но уникальным если задан)
    // ============================================================
    // Сначала удаляем старый уникальный индекс
    const slugIndex = table?.indices.find(
      (idx) =>
        idx.columnNames.includes("slug") || idx.name === "IDX_CUSTOM_PAGES_SLUG"
    );
    if (slugIndex) {
      await queryRunner.dropIndex("custom_pages", slugIndex);
    }

    // Изменяем колонку slug на nullable
    await queryRunner.changeColumn(
      "custom_pages",
      "slug",
      new TableColumn({
        name: "slug",
        type: "varchar",
        isNullable: true,
        isUnique: false, // Уникальность будет через частичный индекс
      })
    );

    // Создаём частичный уникальный индекс (уникальный только для NOT NULL значений)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_CUSTOM_PAGES_SLUG_UNIQUE" 
      ON custom_pages (slug) 
      WHERE slug IS NOT NULL
    `);

    // ============================================================
    // 9. Добавляем foreign keys
    // ============================================================

    // FK для ownerId -> users (CASCADE - при удалении пользователя удаляются его страницы)
    await queryRunner.createForeignKey(
      "custom_pages",
      new TableForeignKey({
        columnNames: ["ownerId"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
        name: "FK_CUSTOM_PAGES_OWNER",
      })
    );

    // FK для botId -> bots (SET NULL - при удалении бота связь обнуляется)
    await queryRunner.createForeignKey(
      "custom_pages",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "SET NULL",
        name: "FK_CUSTOM_PAGES_BOT",
      })
    );

    // FK для shopId -> shops (SET NULL - при удалении магазина связь обнуляется)
    await queryRunner.createForeignKey(
      "custom_pages",
      new TableForeignKey({
        columnNames: ["shopId"],
        referencedColumnNames: ["id"],
        referencedTableName: "shops",
        onDelete: "SET NULL",
        name: "FK_CUSTOM_PAGES_SHOP",
      })
    );

    // ============================================================
    // 10. Добавляем индексы для оптимизации запросов
    // ============================================================

    // Индекс для поиска страниц по владельцу
    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_OWNER",
        columnNames: ["ownerId"],
      })
    );

    // Индекс для поиска страниц по магазину
    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_SHOP",
        columnNames: ["shopId"],
      })
    );

    // Обновляем индекс для botId (теперь включает NULL значения)
    // Удаляем старый индекс IDX_CUSTOM_PAGES_BOT_STATUS если есть
    const botStatusIndex = table?.indices.find(
      (idx) => idx.name === "IDX_CUSTOM_PAGES_BOT_STATUS"
    );
    if (botStatusIndex) {
      await queryRunner.dropIndex("custom_pages", botStatusIndex);
    }

    // Создаём новый индекс для botId + status
    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_BOT_STATUS",
        columnNames: ["botId", "status"],
      })
    );

    console.log("Migration completed: CustomPages are now independent");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // Откат миграции
    // ============================================================

    const table = await queryRunner.getTable("custom_pages");

    // Удаляем индексы
    const ownerIndex = table?.indices.find(
      (idx) => idx.name === "IDX_CUSTOM_PAGES_OWNER"
    );
    if (ownerIndex) {
      await queryRunner.dropIndex("custom_pages", ownerIndex);
    }

    const shopIndex = table?.indices.find(
      (idx) => idx.name === "IDX_CUSTOM_PAGES_SHOP"
    );
    if (shopIndex) {
      await queryRunner.dropIndex("custom_pages", shopIndex);
    }

    // Удаляем частичный индекс для slug
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_CUSTOM_PAGES_SLUG_UNIQUE"`
    );

    // Удаляем foreign keys
    const ownerFk = table?.foreignKeys.find(
      (fk) => fk.name === "FK_CUSTOM_PAGES_OWNER"
    );
    if (ownerFk) {
      await queryRunner.dropForeignKey("custom_pages", ownerFk);
    }

    const botFk = table?.foreignKeys.find(
      (fk) => fk.name === "FK_CUSTOM_PAGES_BOT"
    );
    if (botFk) {
      await queryRunner.dropForeignKey("custom_pages", botFk);
    }

    const shopFk = table?.foreignKeys.find(
      (fk) => fk.name === "FK_CUSTOM_PAGES_SHOP"
    );
    if (shopFk) {
      await queryRunner.dropForeignKey("custom_pages", shopFk);
    }

    // Удаляем страницы без botId (они не смогут существовать в старой схеме)
    await queryRunner.query(`
      DELETE FROM custom_pages WHERE "botId" IS NULL
    `);

    // Возвращаем botId как NOT NULL
    await queryRunner.changeColumn(
      "custom_pages",
      "botId",
      new TableColumn({
        name: "botId",
        type: "uuid",
        isNullable: false,
      })
    );

    // Возвращаем slug как NOT NULL с уникальностью
    await queryRunner.changeColumn(
      "custom_pages",
      "slug",
      new TableColumn({
        name: "slug",
        type: "varchar",
        isNullable: false,
        isUnique: true,
      })
    );

    // Удаляем колонки
    await queryRunner.dropColumn("custom_pages", "shopId");
    await queryRunner.dropColumn("custom_pages", "ownerId");

    // Восстанавливаем старый foreign key для botId с CASCADE
    await queryRunner.createForeignKey(
      "custom_pages",
      new TableForeignKey({
        columnNames: ["botId"],
        referencedColumnNames: ["id"],
        referencedTableName: "bots",
        onDelete: "CASCADE",
      })
    );

    // Восстанавливаем индекс для slug
    await queryRunner.createIndex(
      "custom_pages",
      new TableIndex({
        name: "IDX_CUSTOM_PAGES_SLUG",
        columnNames: ["slug"],
        isUnique: true,
      })
    );

    console.log("Migration rolled back: CustomPages are bound to Bot again");
  }
}
