import { DataSource } from "typeorm";
import { config } from "dotenv";
import { ALL_ENTITIES } from "./entities";

// Загружаем переменные окружения
config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432"),
  username: process.env.DATABASE_USERNAME || "botmanager",
  password: process.env.DATABASE_PASSWORD || "botmanager_password",
  database: process.env.DATABASE_NAME || "botmanager_dev",
  // ВАЖНО: synchronize отключен! Используйте миграции для изменения схемы БД
  // Для локальной разработки можно включить через DB_SYNCHRONIZE=true
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  logging: false,
  // Каждая миграция выполняется в отдельной транзакции
  // Это необходимо для PostgreSQL enum: новые значения не доступны в той же транзакции
  migrationsTransactionMode: "each",
  entities: ALL_ENTITIES,
  migrations: ["src/database/migrations/*.ts"],
  subscribers: ["src/database/subscribers/*.ts"],
});

// Функция для инициализации подключения
export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("✅ База данных успешно подключена");
    }
    return AppDataSource;
  } catch (error) {
    console.error("❌ Ошибка подключения к базе данных:", error);
    throw error;
  }
};
