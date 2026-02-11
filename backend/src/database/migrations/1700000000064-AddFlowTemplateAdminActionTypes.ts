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

    for (const value of newValues) {
      await queryRunner.query(
        `ALTER TYPE "admin_action_type_enum" ADD VALUE IF NOT EXISTS '${value}'`
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // В PostgreSQL нельзя удалить значение из enum без пересоздания типа.
    // Оставляем down пустым — откат потребовал бы пересоздания enum и таблицы.
  }
}
