import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Очистка старых типов enum с суффиксом _old,
 * которые могли остаться после неудачных миграций TypeORM.
 *
 * TypeORM при изменении enum создает копию с суффиксом _old,
 * но если процесс прерывается, эти типы остаются в базе.
 */
export class CleanupOldEnumTypes1700000000041 implements MigrationInterface {
  name = "CleanupOldEnumTypes1700000000041";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Получаем список всех старых enum типов
    const oldEnumTypes = await queryRunner.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname LIKE '%_old' 
        AND typtype = 'e'
    `);

    for (const { typname } of oldEnumTypes) {
      // Находим зависимые колонки
      const dependentColumns = await queryRunner.query(`
        SELECT 
          c.table_schema,
          c.table_name,
          c.column_name,
          c.udt_name
        FROM information_schema.columns c
        WHERE c.udt_name = $1
          AND c.table_schema = 'public'
      `, [typname]);

      // Определяем имя нового типа (без суффикса _old)
      const newTypeName = typname.replace(/_old$/, '');

      // Проверяем существование нового типа
      const newTypeExists = await queryRunner.query(`
        SELECT 1 FROM pg_type WHERE typname = $1
      `, [newTypeName]);

      if (newTypeExists.length > 0 && dependentColumns.length > 0) {
        // Если новый тип существует и есть зависимые колонки,
        // переводим колонки на новый тип
        for (const col of dependentColumns) {
          console.log(`Converting column ${col.table_name}.${col.column_name} from ${typname} to ${newTypeName}`);
          
          try {
            // Преобразуем колонку к новому типу через TEXT
            await queryRunner.query(`
              ALTER TABLE "${col.table_name}" 
              ALTER COLUMN "${col.column_name}" TYPE "${newTypeName}" 
              USING "${col.column_name}"::text::"${newTypeName}"
            `);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to convert column ${col.table_name}.${col.column_name}: ${msg}`);
          }
        }
      }

      // Пытаемся удалить старый тип
      try {
        console.log(`Dropping old enum type: ${typname}`);
        await queryRunner.query(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to drop type ${typname}: ${msg}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Откат не требуется - мы только удаляем мусор
  }
}

