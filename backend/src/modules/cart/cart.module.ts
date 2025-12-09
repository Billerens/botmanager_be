import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Cart } from "../../database/entities/cart.entity";
import { Product } from "../../database/entities/product.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Message } from "../../database/entities/message.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { PublicUser } from "../../database/entities/public-user.entity";
import { CartService } from "./cart.service";
import { BotsModule } from "../bots/bots.module";
import { TelegramModule } from "../telegram/telegram.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { ShopPromocodesModule } from "../shop-promocodes/shop-promocodes.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart,
      Product,
      Shop,
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
    TelegramModule,
    WebSocketModule,
    ShopPromocodesModule,
    ActivityLogModule,
  ],
  controllers: [],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
