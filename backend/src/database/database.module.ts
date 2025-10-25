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
import { Specialist } from "./entities/specialist.entity";
import { Service } from "./entities/service.entity";
import { TimeSlot } from "./entities/time-slot.entity";
import { Booking } from "./entities/booking.entity";

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
          Specialist,
          Service,
          TimeSlot,
          Booking,
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
      Specialist,
      Service,
      TimeSlot,
      Booking,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
