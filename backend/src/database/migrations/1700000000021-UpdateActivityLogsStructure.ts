import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateActivityLogsStructure1700000000021
  implements MigrationInterface
{
  name = "UpdateActivityLogsStructure1700000000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем существование типов перед созданием
    const typeEnumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'activity_logs_type_enum'
      )
    `);

    const levelEnumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'activity_logs_level_enum'
      )
    `);

    // Создаем ENUM тип для ActivityType (если не существует)
    if (!typeEnumExists[0].exists) {
      await queryRunner.query(`
        CREATE TYPE "activity_logs_type_enum" AS ENUM (
          'bot_created', 'bot_updated', 'bot_deleted', 'bot_activated', 'bot_deactivated', 'bot_error',
          'message_received', 'message_sent', 'message_failed', 'message_deleted', 'message_broadcast',
          'lead_created', 'lead_updated', 'lead_status_changed', 'lead_deleted',
          'user_registered', 'user_login', 'user_logout', 'user_updated', 'user_role_changed', 'user_deleted', 'user_password_reset', 'user_telegram_verified', 'user_2fa_enabled', 'user_2fa_disabled',
          'subscription_created', 'subscription_updated', 'subscription_cancelled',
          'flow_created', 'flow_updated', 'flow_deleted', 'flow_executed', 'flow_activated', 'flow_deactivated',
          'product_created', 'product_updated', 'product_deleted', 'product_stock_updated',
          'category_created', 'category_updated', 'category_deleted',
          'order_created', 'order_updated', 'order_status_changed', 'order_deleted',
          'promocode_created', 'promocode_updated', 'promocode_deleted', 'promocode_applied',
          'booking_created', 'booking_updated', 'booking_confirmed', 'booking_cancelled', 'booking_completed', 'booking_no_show', 'booking_deleted',
          'specialist_created', 'specialist_updated', 'specialist_deleted', 'specialist_schedule_updated',
          'service_created', 'service_updated', 'service_deleted',
          'time_slot_created', 'time_slot_updated', 'time_slot_deleted', 'time_slot_generated',
          'webhook_triggered', 'webhook_failed',
          'export_csv', 'api_call'
        )
      `);
    }

    // Создаем ENUM тип для ActivityLevel (если не существует)
    if (!levelEnumExists[0].exists) {
      await queryRunner.query(`
        CREATE TYPE "activity_logs_level_enum" AS ENUM (
          'info', 'warning', 'error', 'success'
        )
      `);
    }

    // Получаем информацию о таблице для проверки существования колонок
    const table = await queryRunner.getTable("activity_logs");
    const hasTypeColumn = table?.findColumnByName("type");
    const hasLevelColumn = table?.findColumnByName("level");
    const hasMessageColumn = table?.findColumnByName("message");
    const hasIpAddressColumn = table?.findColumnByName("ipAddress");
    const hasUserAgentColumn = table?.findColumnByName("userAgent");

    // Добавляем новые поля через SQL, так как TypeORM не поддерживает enum напрямую
    if (!hasTypeColumn) {
      await queryRunner.query(`
        ALTER TABLE "activity_logs" 
        ADD COLUMN "type" activity_logs_type_enum
      `);
    }

    if (!hasLevelColumn) {
      await queryRunner.query(`
        ALTER TABLE "activity_logs" 
        ADD COLUMN "level" activity_logs_level_enum NOT NULL DEFAULT 'info'
      `);
    }

    if (!hasMessageColumn) {
      await queryRunner.addColumn(
        "activity_logs",
        new TableColumn({
          name: "message",
          type: "character varying",
          isNullable: true,
        })
      );
    }

    if (!hasIpAddressColumn) {
      await queryRunner.addColumn(
        "activity_logs",
        new TableColumn({
          name: "ipAddress",
          type: "character varying",
          isNullable: true,
        })
      );
    }

    if (!hasUserAgentColumn) {
      await queryRunner.addColumn(
        "activity_logs",
        new TableColumn({
          name: "userAgent",
          type: "character varying",
          isNullable: true,
        })
      );
    }

    // Мигрируем данные из старых полей в новые (если есть данные)
    // Проверяем, существуют ли старые поля перед миграцией
    // (table уже получен выше)
    const hasActionColumn = table?.findColumnByName("action");
    const hasDescriptionColumn = table?.findColumnByName("description");

    if (hasActionColumn || hasDescriptionColumn) {
      // Безопасная миграция: если action соответствует enum значению, используем его, иначе api_call
      await queryRunner.query(`
        UPDATE "activity_logs" 
        SET "type" = CASE 
          WHEN "action"::text = ANY(ARRAY[
            'bot_created', 'bot_updated', 'bot_deleted', 'bot_activated', 'bot_deactivated', 'bot_error',
            'message_received', 'message_sent', 'message_failed', 'message_deleted', 'message_broadcast',
            'lead_created', 'lead_updated', 'lead_status_changed', 'lead_deleted',
            'user_registered', 'user_login', 'user_logout', 'user_updated', 'user_role_changed', 'user_deleted', 'user_password_reset', 'user_telegram_verified', 'user_2fa_enabled', 'user_2fa_disabled',
            'subscription_created', 'subscription_updated', 'subscription_cancelled',
            'flow_created', 'flow_updated', 'flow_deleted', 'flow_executed', 'flow_activated', 'flow_deactivated',
            'product_created', 'product_updated', 'product_deleted', 'product_stock_updated',
            'category_created', 'category_updated', 'category_deleted',
            'order_created', 'order_updated', 'order_status_changed', 'order_deleted',
            'promocode_created', 'promocode_updated', 'promocode_deleted', 'promocode_applied',
            'booking_created', 'booking_updated', 'booking_confirmed', 'booking_cancelled', 'booking_completed', 'booking_no_show', 'booking_deleted',
            'specialist_created', 'specialist_updated', 'specialist_deleted', 'specialist_schedule_updated',
            'service_created', 'service_updated', 'service_deleted',
            'time_slot_created', 'time_slot_updated', 'time_slot_deleted', 'time_slot_generated',
            'webhook_triggered', 'webhook_failed',
            'export_csv', 'api_call'
          ]::text[])
          THEN "action"::text::activity_logs_type_enum
          ELSE 'api_call'::activity_logs_type_enum
        END,
        "message" = COALESCE("description", '')
        WHERE "type" IS NULL
      `);
    } else {
      // Если старых полей нет, устанавливаем значения по умолчанию
      await queryRunner.query(`
        UPDATE "activity_logs" 
        SET "type" = 'api_call'::activity_logs_type_enum,
            "message" = ''
        WHERE "type" IS NULL
      `);
    }

    // Проверяем, есть ли NULL значения в type перед установкой NOT NULL
    const nullTypeCount = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "activity_logs" WHERE "type" IS NULL
    `);

    // Если есть NULL значения, заполняем их значением по умолчанию
    if (parseInt(nullTypeCount[0].count) > 0) {
      await queryRunner.query(`
        UPDATE "activity_logs" 
        SET "type" = 'api_call'::activity_logs_type_enum
        WHERE "type" IS NULL
      `);
    }

    // Проверяем, есть ли NULL значения в message перед установкой NOT NULL
    const nullMessageCount = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "activity_logs" WHERE "message" IS NULL
    `);

    // Если есть NULL значения, заполняем их пустой строкой
    if (parseInt(nullMessageCount[0].count) > 0) {
      await queryRunner.query(`
        UPDATE "activity_logs" 
        SET "message" = ''
        WHERE "message" IS NULL
      `);
    }

    // Делаем type и message NOT NULL после миграции данных
    // Проверяем, что колонки еще nullable перед изменением
    const currentTable = await queryRunner.getTable("activity_logs");
    const currentTypeColumn = currentTable?.findColumnByName("type");
    const currentMessageColumn = currentTable?.findColumnByName("message");

    if (currentTypeColumn?.isNullable !== false) {
      await queryRunner.query(`
        ALTER TABLE "activity_logs" 
        ALTER COLUMN "type" SET NOT NULL
      `);
    }

    if (currentMessageColumn?.isNullable !== false) {
      await queryRunner.query(`
        ALTER TABLE "activity_logs" 
        ALTER COLUMN "message" SET NOT NULL
      `);
    }

    // Удаляем старые поля (если они существуют)
    // Используем уже полученную таблицу

    if (hasActionColumn) {
      await queryRunner.dropColumn("activity_logs", "action");
    }

    if (hasDescriptionColumn) {
      await queryRunner.dropColumn("activity_logs", "description");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Восстанавливаем старые поля
    await queryRunner.addColumn(
      "activity_logs",
      new TableColumn({
        name: "action",
        type: "character varying",
        isNullable: false,
      })
    );

    await queryRunner.addColumn(
      "activity_logs",
      new TableColumn({
        name: "description",
        type: "character varying",
        isNullable: true,
      })
    );

    // Мигрируем данные обратно
    await queryRunner.query(`
      UPDATE "activity_logs" 
      SET "action" = "type"::text,
          "description" = "message"
    `);

    // Удаляем новые поля
    await queryRunner.dropColumn("activity_logs", "userAgent");
    await queryRunner.dropColumn("activity_logs", "ipAddress");
    await queryRunner.dropColumn("activity_logs", "message");
    await queryRunner.dropColumn("activity_logs", "level");
    await queryRunner.dropColumn("activity_logs", "type");

    // Удаляем ENUM типы
    await queryRunner.query(`DROP TYPE IF EXISTS "activity_logs_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "activity_logs_type_enum"`);
  }
}
