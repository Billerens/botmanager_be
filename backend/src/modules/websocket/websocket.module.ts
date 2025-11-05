import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BotManagerWebSocketGateway } from "./websocket.gateway";
import { NotificationService } from "./services/notification.service";
import { RedisService } from "./services/redis.service";
import { NotificationSettingsService } from "./services/notification-settings.service";
import { WebSocketSettingsController } from "./websocket-settings.controller";
import { AuthModule } from "../auth/auth.module";
import { User } from "../../database/entities/user.entity";
import redisConfig from "./config/redis.config";

/**
 * Глобальный модуль WebSocket для отправки уведомлений
 * Может быть использован любым модулем приложения
 */
@Global()
@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    TypeOrmModule.forFeature([User]),
    JwtModule,
    AuthModule,
  ],
  controllers: [WebSocketSettingsController],
  providers: [
    BotManagerWebSocketGateway,
    NotificationService,
    RedisService,
    NotificationSettingsService,
  ],
  exports: [
    BotManagerWebSocketGateway,
    NotificationService,
    RedisService,
    NotificationSettingsService,
  ],
})
export class WebSocketModule {}
