import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { ThrottlerModule } from "@nestjs/throttler";

import { DatabaseModule } from "./database/database.module";
import databaseConfig from "./config/database.config";
import jwtConfig from "./config/jwt.config";
import appConfig from "./config/configuration";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { BotsModule } from "./modules/bots/bots.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";
import { QueueModule } from "./modules/queue/queue.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { AssistantBotModule } from "./modules/assistant-bot/assistant-bot.module";
import { SubscriptionModule } from "./modules/subscription/subscription.module";
import { UploadModule } from "./modules/upload/upload.module";
import { BookingModule } from "./modules/booking/booking.module";

@Module({
  imports: [
    // Конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [databaseConfig, jwtConfig, appConfig],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 минута
        limit: 100, // 100 запросов в минуту
      },
    ]),

    // База данных
    DatabaseModule,

    // Очереди
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),

    // Модули приложения
    AuthModule,
    UsersModule,
    BotsModule,
    MessagesModule,
    LeadsModule,
    AnalyticsModule,
    WebSocketModule,
    QueueModule,
    TelegramModule, // Управление ботами пользователей
    AssistantBotModule, // Наш собственный бот-ассистент
    SubscriptionModule,
    UploadModule,
    BookingModule, // Система бронирования
  ],
})
export class AppModule {}
