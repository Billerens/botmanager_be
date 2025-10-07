import { DataSource } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/user.entity";
import { Bot } from "./entities/bot.entity";
import { Message } from "./entities/message.entity";
import { Lead } from "./entities/lead.entity";
import { Subscription } from "./entities/subscription.entity";
import { BotFlow } from "./entities/bot-flow.entity";
import { BotFlowNode } from "./entities/bot-flow-node.entity";
import { ActivityLog } from "./entities/activity-log.entity";

// Загружаем переменные окружения
config();

// Определяем пути к миграциям в зависимости от окружения
const isProduction = process.env.NODE_ENV === "production";
const migrationPaths = isProduction
  ? ["dist/src/database/migrations/*.js"]
  : ["src/database/migrations/*.ts"];

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432"),
  username: process.env.DATABASE_USERNAME || "botmanager",
  password: process.env.DATABASE_PASSWORD || "botmanager_password",
  database: process.env.DATABASE_NAME || "botmanager_dev",
  synchronize: false, // Отключаем синхронизацию в пользу миграций
  logging: process.env.NODE_ENV === "development" ? ["error", "warn"] : false,
  entities: [
    User,
    Bot,
    Message,
    Lead,
    Subscription,
    BotFlow,
    BotFlowNode,
    ActivityLog,
  ],
  migrations: migrationPaths,
  migrationsRun: false, // Отключаем автоматический запуск миграций TypeORM
  subscribers: isProduction ? [] : ["src/database/subscribers/*.ts"],
  // Настройки для продакшена
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  extra: {
    // Настройки пула соединений для продакшена
    max: isProduction ? 20 : 10,
    min: isProduction ? 5 : 2,
    acquireTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
  },
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
