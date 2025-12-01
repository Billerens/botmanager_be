import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentProviderFactory } from "./providers/payment-provider.factory";
import { TronMonitorService } from "./services/tron-monitor.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { Bot } from "../../database/entities/bot.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, BotCustomData]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProviderFactory,
    TronMonitorService,
    ExchangeRateService,
  ],
  exports: [
    PaymentsService,
    PaymentProviderFactory,
    TronMonitorService,
    ExchangeRateService,
  ],
})
export class PaymentsModule {}

