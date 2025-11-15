import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Bot } from "../../database/entities/bot.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Message } from "../../database/entities/message.entity";
import { Lead } from "../../database/entities/lead.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { BotsService } from "./bots.service";
import { BotsController } from "./bots.controller";
import { PublicBotsController } from "./public-bots.controller";
import { BotFlowsService } from "./bot-flows.service";
import { BotFlowsController } from "./bot-flows.controller";
import { FlowExecutionService } from "./flow-execution.service";
import { EndpointController } from "./endpoint.controller";
import { TelegramModule } from "../telegram/telegram.module";
import { MessagesModule } from "../messages/messages.module";
import { ProductsModule } from "../products/products.module";
import { CartModule } from "../cart/cart.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { CustomLoggerService } from "../../common/logger.service";
import {
  NodeHandlerService,
  StartNodeHandler,
  MessageNodeHandler,
  KeyboardNodeHandler,
  ConditionNodeHandler,
  EndNodeHandler,
  FormNodeHandler,
  DelayNodeHandler,
  VariableNodeHandler,
  FileNodeHandler,
  RandomNodeHandler,
  WebhookNodeHandler,
  IntegrationNodeHandler,
  NewMessageNodeHandler,
  EndpointNodeHandler,
  BroadcastNodeHandler,
  DatabaseNodeHandler,
} from "./nodes";
import { DatabaseService } from "./database.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bot,
      BotCustomData,
      BotFlow,
      BotFlowNode,
      Product,
      Category,
      Message,
      Lead,
      Specialist,
    ]),
    forwardRef(() => TelegramModule),
    MessagesModule,
    ProductsModule,
    CartModule,
    ActivityLogModule,
  ],
  providers: [
    BotsService,
    BotFlowsService,
    FlowExecutionService,
    DatabaseService,
    CustomLoggerService,
    NodeHandlerService,
    StartNodeHandler,
    MessageNodeHandler,
    KeyboardNodeHandler,
    ConditionNodeHandler,
    EndNodeHandler,
    FormNodeHandler,
    DelayNodeHandler,
    VariableNodeHandler,
    FileNodeHandler,
    RandomNodeHandler,
    WebhookNodeHandler,
    IntegrationNodeHandler,
    NewMessageNodeHandler,
    EndpointNodeHandler,
    BroadcastNodeHandler,
    DatabaseNodeHandler,
  ],
  controllers: [
    BotsController,
    PublicBotsController,
    BotFlowsController,
    EndpointController,
  ],
  exports: [BotsService, BotFlowsService, FlowExecutionService],
})
export class BotsModule {}
