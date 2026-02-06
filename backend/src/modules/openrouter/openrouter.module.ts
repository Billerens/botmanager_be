import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpenRouterController } from "./openrouter.controller";
import { OpenRouterPaidController } from "./openrouter-paid.controller";
import { OpenRouterService } from "../../common/openrouter.service";
import { OpenRouterFeaturedService } from "./openrouter-featured.service";
import { OpenRouterFeaturedModel } from "../../database/entities/openrouter-featured-model.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([OpenRouterFeaturedModel]),
  ],
  controllers: [OpenRouterController, OpenRouterPaidController],
  providers: [OpenRouterService, OpenRouterFeaturedService],
  exports: [OpenRouterService, OpenRouterFeaturedService],
})
export class OpenRouterModule {}

