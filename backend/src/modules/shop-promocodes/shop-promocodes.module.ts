import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ShopPromocodesService } from "./shop-promocodes.service";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Category } from "../../database/entities/category.entity";
import { Product } from "../../database/entities/product.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { BotsModule } from "../bots/bots.module";
import { ShopPermissionsModule } from "../shops/shop-permissions.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopPromocode, Shop, Category, Product]),
    ActivityLogModule,
    ShopPermissionsModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [],
  providers: [ShopPromocodesService],
  exports: [ShopPromocodesService],
})
export class ShopPromocodesModule {}
