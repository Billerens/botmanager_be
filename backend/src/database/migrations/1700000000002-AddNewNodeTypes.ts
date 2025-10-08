import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewNodeTypes1700000000002 implements MigrationInterface {
  name = "AddNewNodeTypes1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Проверяем, существует ли тип enum
    const typeExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'bot_flow_nodes_type_enum'
      );
    `);

    if (!typeExists[0].exists) {
      throw new Error(
        'ENUM тип bot_flow_nodes_type_enum не существует. ' +
        'Сначала необходимо применить миграцию UpdateNodeTypeEnum1700000000001'
      );
    }

    // Добавляем новые типы узлов в enum
    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'form';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'delay';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'variable';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'file';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'webhook';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'random';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'loop';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'timer';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'notification';
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bot_flow_nodes_type_enum" 
      ADD VALUE IF NOT EXISTS 'integration';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем добавленные типы узлов
    // Примечание: PostgreSQL не поддерживает удаление значений из enum
    // Для полного отката потребуется пересоздать таблицу
    console.log(
      "Откат миграции AddNewNodeTypes - удаление значений enum не поддерживается в PostgreSQL"
    );
  }
}
