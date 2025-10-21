import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { BotsModule } from "../bots/bots.module";
import { MessagesModule } from "../messages/messages.module";
import { LeadsModule } from "../leads/leads.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

/**
 * Модуль для управления БОТАМИ ПОЛЬЗОВАТЕЛЕЙ
 *
 * НЕ путать с AssistantBotModule - это для нашего собственного бота-помощника!
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BotsModule),
    forwardRef(() => MessagesModule),
    LeadsModule,
    ActivityLogModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
