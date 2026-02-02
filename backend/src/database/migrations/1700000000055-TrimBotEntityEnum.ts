import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Урезание enum сущностей бота: удаляются права магазина, букинга и custom page.
 * Они переносятся в отдельные модели (Shop, BookingSystem, CustomPage).
 */
export class TrimBotEntityEnum1700000000055 implements MigrationInterface {
  name = "TrimBotEntityEnum1700000000055";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Создаём новый enum только с оставшимися значениями
    await queryRunner.query(`
      CREATE TYPE bot_user_permissions_entity_enum_new AS ENUM (
        'bot_settings', 'flows', 'messages', 'leads', 'analytics', 'bot_users', 'custom_data'
      )
    `);

    // 2. Удаляем строки с удалёнными сущностями (products, categories, orders, carts, specialists, bookings, shop_settings, booking_settings, custom_pages, shop_promocodes)
    await queryRunner.query(`
      DELETE FROM bot_user_permissions
      WHERE entity::text NOT IN (
        'bot_settings', 'flows', 'messages', 'leads', 'analytics', 'bot_users', 'custom_data'
      )
    `);

    // 3. Меняем тип колонки entity на новый enum (через приведение через text)
    await queryRunner.query(`
      ALTER TABLE bot_user_permissions
      ALTER COLUMN entity TYPE bot_user_permissions_entity_enum_new
      USING entity::text::bot_user_permissions_entity_enum_new
    `);

    // 4. Удаляем старый тип
    await queryRunner.query(`
      DROP TYPE bot_user_permissions_entity_enum
    `);

    // 5. Переименовываем новый тип в исходное имя (для совместимости с TypeORM/entity)
    await queryRunner.query(`
      ALTER TYPE bot_user_permissions_entity_enum_new RENAME TO bot_user_permissions_entity_enum
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Создаём старый enum со всеми значениями
    await queryRunner.query(`
      CREATE TYPE bot_user_permissions_entity_enum_old AS ENUM (
        'bot_settings', 'flows', 'messages', 'leads', 'products', 'categories',
        'orders', 'carts', 'specialists', 'bookings', 'analytics', 'shop_settings',
        'booking_settings', 'custom_pages', 'bot_users', 'shop_promocodes', 'custom_data'
      )
    `);

    // 2. Меняем тип колонки на старый enum
    await queryRunner.query(`
      ALTER TABLE bot_user_permissions
      ALTER COLUMN entity TYPE bot_user_permissions_entity_enum_old
      USING entity::text::bot_user_permissions_entity_enum_old
    `);

    // 3. Удаляем текущий тип
    await queryRunner.query(`
      DROP TYPE bot_user_permissions_entity_enum
    `);

    // 4. Переименовываем старый тип в исходное имя
    await queryRunner.query(`
      ALTER TYPE bot_user_permissions_entity_enum_old RENAME TO bot_user_permissions_entity_enum
    `);
  }
}
