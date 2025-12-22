import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from "typeorm";

/**
 * Миграция для добавления поля slug к shops и bots
 *
 * slug используется для публичных субдоменов:
 * - {slug}.shops.botmanagertest.online → магазин
 * - {slug}.booking.botmanagertest.online → бронирование (бот)
 * - {slug}.pages.botmanagertest.online → кастомная страница (уже есть)
 */
export class AddSlugFields1700000000036 implements MigrationInterface {
  name = "AddSlugFields1700000000036";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Добавляем slug в таблицу shops
    await queryRunner.addColumn(
      "shops",
      new TableColumn({
        name: "slug",
        type: "varchar",
        length: "100",
        isNullable: true,
        isUnique: true,
      })
    );

    // Индекс для быстрого поиска по slug
    await queryRunner.createIndex(
      "shops",
      new TableIndex({
        name: "IDX_shops_slug",
        columnNames: ["slug"],
        isUnique: true,
      })
    );

    // Добавляем slug в таблицу bots (для booking)
    await queryRunner.addColumn(
      "bots",
      new TableColumn({
        name: "slug",
        type: "varchar",
        length: "100",
        isNullable: true,
        isUnique: true,
      })
    );

    // Индекс для быстрого поиска по slug
    await queryRunner.createIndex(
      "bots",
      new TableIndex({
        name: "IDX_bots_slug",
        columnNames: ["slug"],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем индексы
    await queryRunner.dropIndex("bots", "IDX_bots_slug");
    await queryRunner.dropIndex("shops", "IDX_shops_slug");

    // Удаляем колонки
    await queryRunner.dropColumn("bots", "slug");
    await queryRunner.dropColumn("shops", "slug");
  }
}
