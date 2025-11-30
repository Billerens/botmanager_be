import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AssistantBotService } from "./assistant-bot.service";
import { AssistantBotController } from "./assistant-bot.controller";
import { User } from "../../database/entities/user.entity";
import { AuthModule } from "../auth/auth.module";

/**
 * Модуль бота-ассистента BotManager
 * 
 * Этот модуль отвечает за нашего СОБСТВЕННОГО бота,
 * который помогает пользователям регистрироваться в системе.
 * 
 * НЕ путать с TelegramModule, который управляет ботами ПОЛЬЗОВАТЕЛЕЙ!
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    AuthModule,
  ],
  providers: [AssistantBotService],
  controllers: [AssistantBotController],
  exports: [AssistantBotService],
})
export class AssistantBotModule {}

