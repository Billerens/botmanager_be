import { Module } from "@nestjs/common";
import { AgentToolsController } from "./agent-tools.controller";
import { AgentToolsService } from "./agent-tools.service";
import { BotsModule } from "../bots/bots.module";
import { BookingModule } from "../booking/booking.module";
import { ProductsModule } from "../products/products.module";
import { CategoriesModule } from "../categories/categories.module";

@Module({
  imports: [BotsModule, BookingModule, ProductsModule, CategoriesModule],
  controllers: [AgentToolsController],
  providers: [AgentToolsService],
  exports: [AgentToolsService],
})
export class AgentToolsModule {}
