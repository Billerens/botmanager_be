import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ShopsService } from "./shops.service";
import { ShopInvitationsService } from "./shop-invitations.service";
import { ShopsController } from "./shops.controller";
import { PublicShopsController } from "./public-shops.controller";
import { ShopPermissionsModule } from "./shop-permissions.module";
import { Shop } from "../../database/entities/shop.entity";
import { ShopInvitation } from "../../database/entities/shop-invitation.entity";
import { User } from "../../database/entities/user.entity";
import { Bot } from "../../database/entities/bot.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Order } from "../../database/entities/order.entity";
import { Cart } from "../../database/entities/cart.entity";
import { PublicUser } from "../../database/entities/public-user.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { ProductsModule } from "../products/products.module";
import { CategoriesModule } from "../categories/categories.module";
import { CartModule } from "../cart/cart.module";
import { OrdersModule } from "../orders/orders.module";
import { ShopPromocodesModule } from "../shop-promocodes/shop-promocodes.module";
import { TelegramModule } from "../telegram/telegram.module";
import { PublicAuthModule } from "../public-auth/public-auth.module";
import { BotsModule } from "../bots/bots.module";
import { CustomDomainsModule } from "../custom-domains/custom-domains.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shop,
      ShopInvitation,
      User,
      Bot,
      BookingSystem,
      Product,
      Category,
      Order,
      Cart,
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
    ActivityLogModule,
    ShopPermissionsModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => CategoriesModule),
    forwardRef(() => CartModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => ShopPromocodesModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => PublicAuthModule),
    forwardRef(() => BotsModule),
    forwardRef(() => CustomDomainsModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [ShopsController, PublicShopsController],
  providers: [ShopsService, ShopInvitationsService],
  exports: [ShopsService],
})
export class ShopsModule {}
