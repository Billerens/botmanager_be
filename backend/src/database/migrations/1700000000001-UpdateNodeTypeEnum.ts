import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNodeTypeEnum1700000000001 implements MigrationInterface {
  name = "UpdateNodeTypeEnum1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли уже тип enum
    const typeExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'bot_flow_nodes_type_enum'
      );
    `);

    if (typeExists[0].exists) {
      // Если тип существует, переименовываем его
      await queryRunner.query(`
        ALTER TYPE bot_flow_nodes_type_enum RENAME TO bot_flow_nodes_type_enum_old;
      `);

      await queryRunner.query(`
        CREATE TYPE bot_flow_nodes_type_enum AS ENUM ('start', 'message', 'keyboard', 'condition', 'api', 'end');
      `);

      await queryRunner.query(`
        ALTER TABLE bot_flow_nodes 
        ALTER COLUMN type TYPE bot_flow_nodes_type_enum 
        USING type::text::bot_flow_nodes_type_enum;
      `);

      await queryRunner.query(`
        DROP TYPE bot_flow_nodes_type_enum_old;
      `);
    } else {
      // Если тип не существует, просто создаем его
      await queryRunner.query(`
        CREATE TYPE bot_flow_nodes_type_enum AS ENUM ('start', 'message', 'keyboard', 'condition', 'api', 'end');
      `);

      // Изменяем тип колонки с varchar на enum
      await queryRunner.query(`
        ALTER TABLE bot_flow_nodes 
        ALTER COLUMN type TYPE bot_flow_nodes_type_enum 
        USING type::text::bot_flow_nodes_type_enum;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли тип enum
    const typeExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'bot_flow_nodes_type_enum'
      );
    `);

    if (typeExists[0].exists) {
      // Если тип существует, сначала меняем колонку на varchar
      await queryRunner.query(`
        ALTER TABLE bot_flow_nodes 
        ALTER COLUMN type TYPE character varying 
        USING type::text;
      `);

      // Удаляем enum тип
      await queryRunner.query(`
        DROP TYPE bot_flow_nodes_type_enum;
      `);
    }
  }
}
