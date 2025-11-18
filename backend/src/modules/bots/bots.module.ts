import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";

import { Bot } from "../../database/entities/bot.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Message } from "../../database/entities/message.entity";
import { Lead } from "../../database/entities/lead.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { UserSession } from "../../database/entities/user-session.entity";
import { GroupSession } from "../../database/entities/group-session.entity";
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
import { WebSocketModule } from "../websocket/websocket.module";
import { CustomPagesModule } from "../custom-pages/custom-pages.module";
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
  LocationNodeHandler,
  CalculatorNodeHandler,
  TransformNodeHandler,
  GroupCreateNodeHandler,
  GroupJoinNodeHandler,
  GroupActionNodeHandler,
  GroupLeaveNodeHandler,
} from "./nodes";
import { DatabaseService } from "./database.service";
import { SessionStorageService } from "./session-storage.service";
import { GroupSessionService } from "./group-session.service";
import { GroupActionsProcessor } from "./processors/group-actions.processor";

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
      UserSession,
      GroupSession,
    ]),
    BullModule.registerQueue({
      name: "group-actions",
    }),
    forwardRef(() => TelegramModule),
    MessagesModule,
    ProductsModule,
    CartModule,
    ActivityLogModule,
    WebSocketModule,
    CustomPagesModule,
  ],
  providers: [
    BotsService,
    BotFlowsService,
    FlowExecutionService,
    DatabaseService,
    SessionStorageService,
    GroupSessionService,
    GroupActionsProcessor,
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
    LocationNodeHandler,
    CalculatorNodeHandler,
    TransformNodeHandler,
    GroupCreateNodeHandler,
    GroupJoinNodeHandler,
    GroupActionNodeHandler,
    GroupLeaveNodeHandler,
  ],
  controllers: [
    BotsController,
    PublicBotsController,
    BotFlowsController,
    EndpointController,
  ],
  exports: [
    BotsService,
    BotFlowsService,
    FlowExecutionService,
    SessionStorageService,
    GroupSessionService,
  ],
})
export class BotsModule {}
