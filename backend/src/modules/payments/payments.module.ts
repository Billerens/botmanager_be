import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PaymentsController } from "./payments.controller";
import { PaymentConfigController } from "./controllers/payment-config.controller";
import { EntityPaymentController } from "./controllers/entity-payment.controller";
import { EntityWebhookController } from "./controllers/entity-webhook.controller";
import { PaymentsService } from "./payments.service";
import { PaymentConfigService } from "./services/payment-config.service";
import { PaymentTestService } from "./services/payment-test.service";
import { PaymentTransactionService } from "./services/payment-transaction.service";
import { PaymentProviderFactory } from "./providers/payment-provider.factory";
import { TronMonitorService } from "./services/tron-monitor.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { Bot } from "../../database/entities/bot.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { PaymentConfig } from "../../database/entities/payment-config.entity";
import { Payment } from "../../database/entities/payment.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { Order } from "../../database/entities/order.entity";
import { Booking } from "../../database/entities/booking.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bot,
      BotCustomData,
      PaymentConfig,
      Payment,
      Shop,
      BookingSystem,
      CustomPage,
      Order,
      Booking,
    ]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [
    // ВАЖНО: контроллеры с более специфичными путями должны быть первыми,
    // иначе generic маршруты типа /:botId/:module/:provider/:externalPaymentId
    // в PaymentsController перехватят запросы раньше
    EntityPaymentController,
    EntityWebhookController,
    PaymentConfigController,
    PaymentsController,
  ],
  providers: [
    PaymentsService,
    PaymentConfigService,
    PaymentTestService,
    PaymentTransactionService,
    PaymentProviderFactory,
    TronMonitorService,
    ExchangeRateService,
  ],
  exports: [
    PaymentsService,
    PaymentConfigService,
    PaymentTestService,
    PaymentTransactionService,
    PaymentProviderFactory,
    TronMonitorService,
    ExchangeRateService,
  ],
})
export class PaymentsModule {}

