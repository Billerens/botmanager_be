import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { Bot } from "../../database/entities/bot.entity";
import { BotFlow } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { CustomData } from "../../database/entities/custom-data.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";

import { AuthModule } from "../auth/auth.module";
import { BotsModule } from "../bots/bots.module";

import { SimulationGateway } from "./simulation.gateway";
import { SimulationService } from "./simulation.service";
import { SimulationController } from "./simulation.controller";
import { SimulationSessionStore } from "./simulation-session.store";
import { SimulationTransportService } from "./simulation-transport.service";
import { CustomLoggerService } from "../../common/logger.service";

/**
 * Модуль симуляции Botflow.
 *
 * Предоставляет:
 * - WebSocket Gateway (/simulation namespace) для запуска и управления симуляциями
 * - REST Controller (POST /simulation/guest-token) для выдачи guest-токенов
 * - Изолированный контекст выполнения flow (in-memory session, variables, customData)
 * - Подменяемый transport layer (WebSocket вместо Telegram API)
 *
 * Зависимости:
 * - AuthModule — JWT аутентификация
 * - BotsModule — NodeHandlerService (общие обработчики узлов)
 * - TypeORM entities — Bot, BotFlow, BotFlowNode, BotCustomData, CustomData
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bot,
      BotFlow,
      BotFlowNode,
      BotCustomData,
      CustomData,
      Shop,
      BookingSystem,
      CustomPage,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
        signOptions: { expiresIn: configService.get<string>("jwt.expiresIn") },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [SimulationController],
  providers: [
    SimulationGateway,
    SimulationService,
    SimulationSessionStore,
    SimulationTransportService,
    CustomLoggerService,
  ],
  exports: [SimulationService],
})
export class SimulationModule {}
