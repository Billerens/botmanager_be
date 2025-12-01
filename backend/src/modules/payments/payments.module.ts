import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentProviderFactory } from "./providers/payment-provider.factory";
import { Bot } from "../../database/entities/bot.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Bot, BotCustomData])],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderFactory],
  exports: [PaymentsService, PaymentProviderFactory],
})
export class PaymentsModule {}

