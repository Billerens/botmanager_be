import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "../../database/entities/order.entity";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Message } from "../../database/entities/message.entity";
import { OrdersService } from "./orders.service";
import { PublicOrdersController, OrdersController } from "./orders.controller";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";
import { TelegramInitDataValidationService } from "../../common/telegram-initdata-validation.service";
import { BotsModule } from "../bots/bots.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { ShopPromocodesModule } from "../shop-promocodes/shop-promocodes.module";
import { CartModule } from "../cart/cart.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Cart, Product, Bot, Message]),
    forwardRef(() => BotsModule),
    WebSocketModule,
    forwardRef(() => ShopPromocodesModule),
    forwardRef(() => CartModule),
  ],
  controllers: [PublicOrdersController, OrdersController],
  providers: [
    OrdersService,
    TelegramInitDataGuard,
    TelegramInitDataValidationService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

