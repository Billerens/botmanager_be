import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { TelegramWebhookService } from "./telegram-webhook.service";
import { TelegramWebhookController } from "./telegram-webhook.controller";
import { BotsModule } from "../bots/bots.module";
import { MessagesModule } from "../messages/messages.module";
import { LeadsModule } from "../leads/leads.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { User } from "../../database/entities/user.entity";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    forwardRef(() => BotsModule),
    forwardRef(() => MessagesModule),
    LeadsModule,
    ActivityLogModule,
  ],
  providers: [TelegramService, TelegramWebhookService],
  controllers: [TelegramController, TelegramWebhookController],
  exports: [TelegramService, TelegramWebhookService],
})
export class TelegramModule {}
