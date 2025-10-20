import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Bot } from "../../database/entities/bot.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { Product } from "../../database/entities/product.entity";
import { Message } from "../../database/entities/message.entity";
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
} from "./nodes";

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, BotFlow, BotFlowNode, Product, Message]),
    forwardRef(() => TelegramModule),
    MessagesModule,
    ProductsModule,
  ],
  providers: [
    BotsService,
    BotFlowsService,
    FlowExecutionService,
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
