import { AppDataSource } from "./src/database/data-source";

async function testConnection() {
  try {
    console.log("🔍 Проверяем подключение к базе данных...");
    console.log("📋 Конфигурация:");
    console.log(`  - Host: ${process.env.DATABASE_HOST || "localhost"}`);
    console.log(`  - Port: ${process.env.DATABASE_PORT || "5432"}`);
    console.log(`  - Database: ${process.env.DATABASE_NAME || "botmanager_dev"}`);
    console.log(`  - Username: ${process.env.DATABASE_USERNAME || "botmanager"}`);
    
    await AppDataSource.initialize();
    console.log("✅ Подключение к базе данных успешно!");
    
    // Проверяем существующие таблицы
    const tables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("📊 Существующие таблицы:");
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Проверяем структуру таблицы users
    const userColumns = await AppDataSource.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log("\n👤 Структура таблицы users:");
    userColumns.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
    });
    
    await AppDataSource.destroy();
    console.log("🔌 Подключение закрыто");
    
  } catch (error) {
    console.error("❌ Ошибка подключения к базе данных:");
    console.error(error);
  }
}

testConnection();
