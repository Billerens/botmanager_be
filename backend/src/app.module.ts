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
import { SubscriptionModule } from "./modules/subscription/subscription.module";

// Проверяем наличие Redis
const hasRedis = !!process.env.REDIS_URL || !!process.env.REDIS_HOST;

@Module({
  imports: [
    // Конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [databaseConfig, jwtConfig, appConfig],
    }),

    // Rate limiting (только если есть Redis)
    ...(hasRedis ? [
      ThrottlerModule.forRoot([
        {
          ttl: 60000, // 1 минута
          limit: 100, // 100 запросов в минуту
        },
      ]),
    ] : []),

    // База данных
    DatabaseModule,

    // Очереди (только если есть Redis)
    ...(hasRedis ? [
      BullModule.forRoot({
        redis: process.env.REDIS_URL || {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD,
        },
      }),
    ] : []),

    // Модули приложения
    AuthModule,
    UsersModule,
    BotsModule,
    MessagesModule,
    LeadsModule,
    AnalyticsModule,
    WebSocketModule,
    QueueModule, // QueueModule всегда импортируется, но работает условно
    TelegramModule,
    SubscriptionModule,
  ],
})
export class AppModule {}
