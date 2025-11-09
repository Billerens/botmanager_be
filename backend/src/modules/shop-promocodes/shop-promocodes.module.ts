import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ShopPromocodesService } from "./shop-promocodes.service";
import { ShopPromocodesController } from "./shop-promocodes.controller";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Category } from "../../database/entities/category.entity";
import { Product } from "../../database/entities/product.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopPromocode, Bot, Category, Product]),
    ActivityLogModule,
  ],
  controllers: [ShopPromocodesController],
  providers: [ShopPromocodesService],
  exports: [ShopPromocodesService],
})
export class ShopPromocodesModule {}

