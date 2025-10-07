import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { BotsModule } from "../bots/bots.module";
import { MessagesModule } from "../messages/messages.module";
import { LeadsModule } from "../leads/leads.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => BotsModule),
    MessagesModule,
    LeadsModule,
    ActivityLogModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
