import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";
import { TelegramInitDataValidationService } from "../../common/telegram-initdata-validation.service";
import { BotsModule } from "../bots/bots.module";
import { TelegramModule } from "../telegram/telegram.module";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, Product, Bot]),
    forwardRef(() => BotsModule),
    TelegramModule,
    WebSocketModule,
  ],
  controllers: [CartController],
  providers: [
    CartService,
    TelegramInitDataGuard,
    TelegramInitDataValidationService,
  ],
  exports: [CartService],
})
export class CartModule {}
