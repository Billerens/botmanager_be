import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ShopPromocodesService } from "./shop-promocodes.service";
import { ShopPromocodesController } from "./shop-promocodes.controller";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Category } from "../../database/entities/category.entity";
import { Product } from "../../database/entities/product.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { BotsModule } from "../bots/bots.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopPromocode, Bot, Category, Product]),
    ActivityLogModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [ShopPromocodesController],
  providers: [ShopPromocodesService],
  exports: [ShopPromocodesService],
})
export class ShopPromocodesModule {}
