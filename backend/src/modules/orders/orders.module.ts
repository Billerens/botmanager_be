import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Order } from "../../database/entities/order.entity";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Message } from "../../database/entities/message.entity";
import { PublicUser } from "../../database/entities/public-user.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { OrdersService } from "./orders.service";
import { PublicOrdersController, OrdersController } from "./orders.controller";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";
import { PublicAccessGuard } from "../public-auth/guards/public-access.guard";
import { TelegramInitDataValidationService } from "../../common/telegram-initdata-validation.service";
import { BotsModule } from "../bots/bots.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { ShopPromocodesModule } from "../shop-promocodes/shop-promocodes.module";
import { CartModule } from "../cart/cart.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Cart,
      Product,
      Bot,
      Message,
      ShopPromocode,
      PublicUser,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => BotsModule),
    WebSocketModule,
    forwardRef(() => ShopPromocodesModule),
    forwardRef(() => CartModule),
    ActivityLogModule,
  ],
  controllers: [PublicOrdersController, OrdersController],
  providers: [
    OrdersService,
    TelegramInitDataGuard,
    PublicAccessGuard,
    TelegramInitDataValidationService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

