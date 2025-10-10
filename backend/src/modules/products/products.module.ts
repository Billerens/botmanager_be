import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { Product } from "../../database/entities/product.entity";
import { Bot } from "../../database/entities/bot.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Product, Bot])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
