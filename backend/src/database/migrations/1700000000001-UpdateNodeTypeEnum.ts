import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNodeTypeEnum1700000000001 implements MigrationInterface {
  name = "UpdateNodeTypeEnum1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Сначала удаляем старый enum и создаем новый
    await queryRunner.query(`
      ALTER TYPE bot_flow_nodes_type_enum RENAME TO bot_flow_nodes_type_enum_old;
    `);

    await queryRunner.query(`
      CREATE TYPE bot_flow_nodes_type_enum AS ENUM ('start', 'message', 'keyboard', 'condition', 'api', 'end');
    `);

    // Обновляем колонку для использования нового enum
    await queryRunner.query(`
      ALTER TABLE bot_flow_nodes 
      ALTER COLUMN type TYPE bot_flow_nodes_type_enum 
      USING type::text::bot_flow_nodes_type_enum;
    `);

    // Удаляем старый enum
    await queryRunner.query(`
      DROP TYPE bot_flow_nodes_type_enum_old;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Возвращаем старый enum
    await queryRunner.query(`
      ALTER TYPE bot_flow_nodes_type_enum RENAME TO bot_flow_nodes_type_enum_new;
    `);

    await queryRunner.query(`
      CREATE TYPE bot_flow_nodes_type_enum AS ENUM ('trigger', 'message', 'condition', 'form', 'delay', 'webhook', 'assignment', 'end');
    `);

    await queryRunner.query(`
      ALTER TABLE bot_flow_nodes 
      ALTER COLUMN type TYPE bot_flow_nodes_type_enum 
      USING type::text::bot_flow_nodes_type_enum;
    `);

    await queryRunner.query(`
      DROP TYPE bot_flow_nodes_type_enum_new;
    `);
  }
}
