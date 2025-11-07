import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesService } from "./categories.service";
import { CategoriesController } from "./categories.controller";
import { Category } from "../../database/entities/category.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Product } from "../../database/entities/product.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Category, Bot, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}

