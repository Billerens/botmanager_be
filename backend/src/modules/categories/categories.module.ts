import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesService } from "./categories.service";
import { CategoriesController } from "./categories.controller";
import { Category } from "../../database/entities/category.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Product } from "../../database/entities/product.entity";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { BotsModule } from "../bots/bots.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Bot, Product]),
    ActivityLogModule,
    forwardRef(() => BotsModule),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}

