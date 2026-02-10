import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Меняем колонку type с PostgreSQL enum на varchar.
 * Enum в БД устарел (не совпадает с NodeType в entity), при каждом новом типе узла
 * приходилось бы добавлять миграцию. С varchar валидация только в приложении.
 */
export class AddPeriodicExecutionToBotFlowNodesTypeEnum1700000000062
  implements MigrationInterface
{
  name = "AddPeriodicExecutionToBotFlowNodesTypeEnum1700000000062";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bot_flow_nodes"
      ALTER COLUMN "type" TYPE character varying(64) USING "type"::text
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "bot_flow_nodes_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "bot_flow_nodes_type_enum" AS ENUM (
        'start', 'message', 'keyboard', 'condition', 'api', 'end',
        'form', 'delay', 'variable', 'file', 'webhook',
        'random', 'loop', 'timer', 'notification', 'integration',
        'periodic_execution', 'periodic_control', 'new_message', 'database',
        'endpoint', 'broadcast', 'group', 'location', 'calculator', 'transform',
        'group_create', 'group_join', 'group_action', 'group_leave',
        'ai_single', 'ai_chat', 'payment'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bot_flow_nodes"
      ALTER COLUMN "type" TYPE "bot_flow_nodes_type_enum" USING "type"::"bot_flow_nodes_type_enum"
    `);
  }
}
