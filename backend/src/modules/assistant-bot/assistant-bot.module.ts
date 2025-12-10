import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AssistantBotService } from "./assistant-bot.service";
import { AssistantBotController } from "./assistant-bot.controller";
import { User } from "../../database/entities/user.entity";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";

/**
 * Модуль бота-ассистента BotManager
 *
 * Этот модуль отвечает за нашего СОБСТВЕННОГО бота,
 * который помогает пользователям регистрироваться в системе.
 *
 * НЕ путать с TelegramModule, который управляет ботами ПОЛЬЗОВАТЕЛЕЙ!
 *
 * Также обрабатывает команды управления администраторами.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    AuthModule,
    forwardRef(() => AdminModule),
  ],
  providers: [AssistantBotService],
  controllers: [AssistantBotController],
  exports: [AssistantBotService],
})
export class AssistantBotModule {}
