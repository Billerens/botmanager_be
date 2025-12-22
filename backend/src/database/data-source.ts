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
import { Product } from "./entities/product.entity";
import { Category } from "./entities/category.entity";
import { Specialist } from "./entities/specialist.entity";
import { Service } from "./entities/service.entity";
import { TimeSlot } from "./entities/time-slot.entity";
import { Booking } from "./entities/booking.entity";
import { Cart } from "./entities/cart.entity";
import { Order } from "./entities/order.entity";
import { ShopPromocode } from "./entities/shop-promocode.entity";
import { UserSession } from "./entities/user-session.entity";
import { BotCustomData } from "./entities/bot-custom-data.entity";
import { CustomPage } from "./entities/custom-page.entity";
import { BotUser } from "./entities/bot-user.entity";
import { BotUserPermission } from "./entities/bot-user-permission.entity";
import { BotInvitation } from "./entities/bot-invitation.entity";
import { GroupSession } from "./entities/group-session.entity";
import { PublicUser } from "./entities/public-user.entity";
import { Shop } from "./entities/shop.entity";
import { Admin } from "./entities/admin.entity";
import { AdminActionLog } from "./entities/admin-action-log.entity";
import { CustomDomain } from "./entities/custom-domain.entity";

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
  entities: [
    User,
    Bot,
    Message,
    Lead,
    Subscription,
    BotFlow,
    BotFlowNode,
    ActivityLog,
    Product,
    Category,
    Specialist,
    Service,
    TimeSlot,
    Booking,
    Cart,
    Order,
    ShopPromocode,
    UserSession,
    BotCustomData,
    CustomPage,
    BotUser,
    BotUserPermission,
    BotInvitation,
    GroupSession,
    PublicUser,
    Shop,
    Admin,
    AdminActionLog,
    CustomDomain,
  ],
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
