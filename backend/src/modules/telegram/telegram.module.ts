import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { BotsModule } from "../bots/bots.module";
import { MessagesModule } from "../messages/messages.module";
import { LeadsModule } from "../leads/leads.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { CustomPagesModule } from "../custom-pages/custom-pages.module";
import { Message } from "../../database/entities/message.entity";
import { Bot } from "../../database/entities/bot.entity";

/**
 * Модуль для управления БОТАМИ ПОЛЬЗОВАТЕЛЕЙ
 *
 * НЕ путать с AssistantBotModule - это для нашего собственного бота-помощника!
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Message, Bot]),
    forwardRef(() => BotsModule),
    forwardRef(() => MessagesModule),
    LeadsModule,
    ActivityLogModule,
    CustomPagesModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
