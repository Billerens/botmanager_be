import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicCrudAccessSettings1700000000054 implements MigrationInterface {
  name = "AddPublicCrudAccessSettings1700000000054";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // Добавляем поля create, update, delete в public секцию accessSettings
    // для существующих записей в custom_collection_schemas
    // ========================================================================
    await queryRunner.query(`
      UPDATE "custom_collection_schemas"
      SET "accessSettings" = jsonb_set(
        jsonb_set(
          jsonb_set(
            "accessSettings",
            '{public,create}',
            'false'::jsonb
          ),
          '{public,update}',
          'false'::jsonb
        ),
        '{public,delete}',
        'false'::jsonb
      )
      WHERE "accessSettings"->'public'->'create' IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // Откат: удаляем поля create, update, delete из public секции
    // ========================================================================
    await queryRunner.query(`
      UPDATE "custom_collection_schemas"
      SET "accessSettings" = "accessSettings" #- '{public,create}' 
                                              #- '{public,update}' 
                                              #- '{public,delete}'
    `);
  }
}
