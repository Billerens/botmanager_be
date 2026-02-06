import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OpenRouterController } from "./openrouter.controller";
import { OpenRouterPaidController } from "./openrouter-paid.controller";
import { OpenRouterService } from "../../common/openrouter.service";
import { OpenRouterFeaturedService } from "./openrouter-featured.service";
import { OpenRouterAgentSettingsService } from "./openrouter-agent-settings.service";
import { OpenRouterFeaturedModel } from "../../database/entities/openrouter-featured-model.entity";
import { OpenRouterAgentSettings } from "../../database/entities/openrouter-agent-settings.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([OpenRouterFeaturedModel, OpenRouterAgentSettings]),
  ],
  controllers: [OpenRouterController, OpenRouterPaidController],
  providers: [
    OpenRouterService,
    OpenRouterFeaturedService,
    OpenRouterAgentSettingsService,
  ],
  exports: [
    OpenRouterService,
    OpenRouterFeaturedService,
    OpenRouterAgentSettingsService,
  ],
})
export class OpenRouterModule {}

