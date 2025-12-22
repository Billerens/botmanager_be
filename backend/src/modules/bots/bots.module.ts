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
import { Order } from "../../database/entities/order.entity";
import { Service } from "../../database/entities/service.entity";
import { Booking } from "../../database/entities/booking.entity";
import { Cart } from "../../database/entities/cart.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { Shop } from "../../database/entities/shop.entity";
import { TimeSlot } from "../../database/entities/time-slot.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { User } from "../../database/entities/user.entity";
import { BotUser } from "../../database/entities/bot-user.entity";
import { BotUserPermission } from "../../database/entities/bot-user-permission.entity";
import { BotInvitation } from "../../database/entities/bot-invitation.entity";
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
import { AssistantBotModule } from "../assistant-bot/assistant-bot.module";
import { CustomDomainsModule } from "../custom-domains/custom-domains.module";
import { LangChainOpenRouterModule } from "../langchain-openrouter/langchain-openrouter.module";
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
  AiSingleNodeHandler,
  AiChatNodeHandler,
} from "./nodes";
import { AiModelSelectorService } from "./services/ai-model-selector.service";
import { StreamingResponseService } from "./services/streaming-response.service";
import { DatabaseService } from "./database.service";
import { SessionStorageService } from "./session-storage.service";
import { GroupSessionService } from "./group-session.service";
import { GroupActionsProcessor } from "./processors/group-actions.processor";
import { BotPermissionsService } from "./bot-permissions.service";
import { BotInvitationsService } from "./bot-invitations.service";
import { BotNotificationsService } from "./bot-notifications.service";
import { BotPermissionGuard } from "./guards/bot-permission.guard";

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
      Order,
      Service,
      Booking,
      Cart,
      ShopPromocode,
      Shop,
      TimeSlot,
      CustomPage,
      User,
      BotUser,
      BotUserPermission,
      BotInvitation,
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
    AssistantBotModule,
    LangChainOpenRouterModule,
    forwardRef(() => CustomDomainsModule),
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
    AiSingleNodeHandler,
    AiChatNodeHandler,
    AiModelSelectorService,
    StreamingResponseService,
    BotPermissionGuard,
    BotPermissionsService,
    BotInvitationsService,
    BotNotificationsService,
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
    BotPermissionsService,
    BotInvitationsService,
    BotNotificationsService,
  ],
})
export class BotsModule {}
