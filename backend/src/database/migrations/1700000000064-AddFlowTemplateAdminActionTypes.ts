import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFlowTemplateAdminActionTypes1700000000064
  implements MigrationInterface
{
  name = "AddFlowTemplateAdminActionTypes1700000000064";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const newValues = [
      "flow_template_list",
      "flow_template_view",
      "flow_template_create",
      "flow_template_update",
      "flow_template_delete",
      "flow_template_approve",
      "flow_template_reject",
      "flow_template_approve_deletion",
      "flow_template_reject_deletion",
      "flow_template_platform_choice",
      "flow_template_duplicate",
      "flow_template_category_list",
      "flow_template_category_create",
      "flow_template_category_update",
      "flow_template_category_delete",
    ];

    // Поддержка двух вариантов имён: миграция 0034 — admin_action_type_enum;
    // TypeORM/synchronize — admin_action_logs_actiontype_enum (таблица_колонка).
    const rowsShort = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'admin_action_type_enum'`
    );
    const rowsTypeorm = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'admin_action_logs_actiontype_enum'`
    );
    const shortExists = Array.isArray(rowsShort) && rowsShort.length > 0;
    const typeormExists = Array.isArray(rowsTypeorm) && rowsTypeorm.length > 0;
    const enumName = typeormExists
      ? "admin_action_logs_actiontype_enum"
      : shortExists
        ? "admin_action_type_enum"
        : null;

    if (!enumName) {
      // Ни один тип не найден — создаём как в миграции 0034.
      const baseValues = [
        "login",
        "logout",
        "login_failed",
        "password_changed",
        "two_factor_enabled",
        "two_factor_disabled",
        "user_view",
        "user_list",
        "user_update",
        "user_delete",
        "user_block",
        "user_unblock",
        "bot_view",
        "bot_list",
        "bot_update",
        "bot_delete",
        "bot_flow_update",
        "shop_view",
        "shop_list",
        "shop_update",
        "shop_delete",
        "order_view",
        "order_list",
        "order_update",
        "order_cancel",
        "product_view",
        "product_list",
        "product_update",
        "product_delete",
        "lead_view",
        "lead_list",
        "lead_update",
        "lead_delete",
        "message_view",
        "message_list",
        "subscription_view",
        "subscription_list",
        "subscription_update",
        "admin_create",
        "admin_update",
        "admin_delete",
        "admin_password_reset",
        "system_settings_view",
        "system_settings_update",
        "system_logs_view",
        "booking_view",
        "booking_list",
        "booking_update",
        "booking_cancel",
        "custom_page_view",
        "custom_page_list",
        "custom_page_update",
        "custom_page_delete",
      ];
      const allValues = [...baseValues, ...newValues]
        .map((v) => `'${v}'`)
        .join(", ");
      await queryRunner.query(
        `CREATE TYPE "admin_action_type_enum" AS ENUM (${allValues})`
      );
      return;
    }

    for (const value of newValues) {
      await queryRunner.query(
        `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // В PostgreSQL нельзя удалить значение из enum без пересоздания типа.
    // Оставляем down пустым — откат потребовал бы пересоздания enum и таблицы.
  }
}
