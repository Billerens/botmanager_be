import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { Product } from "../../database/entities/product.entity";
import { Category } from "../../database/entities/category.entity";
import { Shop } from "../../database/entities/shop.entity";
import { UploadModule } from "../upload/upload.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { BotsModule } from "../bots/bots.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, Shop]),
    UploadModule,
    ActivityLogModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
