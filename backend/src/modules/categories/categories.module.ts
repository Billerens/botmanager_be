import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesService } from "./categories.service";
import { Category } from "../../database/entities/category.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Product } from "../../database/entities/product.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { BotsModule } from "../bots/bots.module";
import { ShopPermissionsModule } from "../shops/shop-permissions.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Shop, Product]),
    ActivityLogModule,
    ShopPermissionsModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
