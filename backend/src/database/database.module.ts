import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { User } from "./entities/user.entity";
import { Bot } from "./entities/bot.entity";
import { Message } from "./entities/message.entity";
import { Lead } from "./entities/lead.entity";
import { Subscription } from "./entities/subscription.entity";
import { BotFlow } from "./entities/bot-flow.entity";
import { BotFlowNode } from "./entities/bot-flow-node.entity";
import { ActivityLog } from "./entities/activity-log.entity";
import { Product } from "./entities/product.entity";
import { Category } from "./entities/category.entity";
import { Specialist } from "./entities/specialist.entity";
import { Service } from "./entities/service.entity";
import { TimeSlot } from "./entities/time-slot.entity";
import { Booking } from "./entities/booking.entity";
import { Cart } from "./entities/cart.entity";
import { Order } from "./entities/order.entity";
import { ShopPromocode } from "./entities/shop-promocode.entity";
import { UserSession } from "./entities/user-session.entity";
import { BotCustomData } from "./entities/bot-custom-data.entity";
import { CustomPage } from "./entities/custom-page.entity";
import { BotUser } from "./entities/bot-user.entity";
import { BotUserPermission } from "./entities/bot-user-permission.entity";
import { BotInvitation } from "./entities/bot-invitation.entity";
import { GroupSession } from "./entities/group-session.entity";
import { PublicUser } from "./entities/public-user.entity";
import { Shop } from "./entities/shop.entity";
import { Admin } from "./entities/admin.entity";
import { AdminActionLog } from "./entities/admin-action-log.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DATABASE_HOST", "localhost"),
        port: configService.get("DATABASE_PORT", 5432),
        username: configService.get("DATABASE_USERNAME", "botmanager"),
        password: configService.get("DATABASE_PASSWORD", "botmanager_password"),
        database: configService.get("DATABASE_NAME", "botmanager"),
        entities: [
          User,
          Bot,
          Message,
          Lead,
          Subscription,
          BotFlow,
          BotFlowNode,
          ActivityLog,
          Product,
          Category,
          Specialist,
          Service,
          TimeSlot,
          Booking,
          Cart,
          Order,
          ShopPromocode,
          UserSession,
          BotCustomData,
          CustomPage,
          BotUser,
          BotUserPermission,
          BotInvitation,
          GroupSession,
          PublicUser,
          Shop,
          Admin,
          AdminActionLog,
        ],
        synchronize: configService.get("NODE_ENV") === "development",
        logging: false,
        ssl:
          configService.get("NODE_ENV") === "production"
            ? { rejectUnauthorized: false }
            : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Bot,
      Message,
      Lead,
      Subscription,
      BotFlow,
      BotFlowNode,
      ActivityLog,
      Product,
      Category,
      Specialist,
      Service,
      TimeSlot,
      Booking,
      Cart,
      Order,
      ShopPromocode,
      UserSession,
      BotCustomData,
      CustomPage,
      BotUser,
      BotUserPermission,
      BotInvitation,
      GroupSession,
      PublicUser,
      Shop,
      Admin,
      AdminActionLog,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
