import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";
import { TelegramInitDataValidationService } from "../../common/telegram-initdata-validation.service";
import { BotsModule } from "../bots/bots.module";
import { TelegramModule } from "../telegram/telegram.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { ShopPromocodesModule } from "../shop-promocodes/shop-promocodes.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, Product, Bot, Message, ShopPromocode]),
    forwardRef(() => BotsModule),
    TelegramModule,
    WebSocketModule,
    ShopPromocodesModule,
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
