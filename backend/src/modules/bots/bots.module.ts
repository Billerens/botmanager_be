import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Bot } from "../../database/entities/bot.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { BotsService } from "./bots.service";
import { BotsController } from "./bots.controller";
import { BotFlowsService } from "./bot-flows.service";
import { BotFlowsController } from "./bot-flows.controller";
import { FlowExecutionService } from "./flow-execution.service";
import { TelegramModule } from "../telegram/telegram.module";
import { MessagesModule } from "../messages/messages.module";
import { CustomLoggerService } from "../../common/logger.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, BotFlow, BotFlowNode]),
    forwardRef(() => TelegramModule),
    MessagesModule,
  ],
  providers: [
    BotsService,
    BotFlowsService,
    FlowExecutionService,
    CustomLoggerService,
  ],
  controllers: [BotsController, BotFlowsController],
  exports: [BotsService, BotFlowsService, FlowExecutionService],
})
export class BotsModule {}
