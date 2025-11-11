import { Module } from "@nestjs/common";
import { OpenRouterController } from "./openrouter.controller";
import { OpenRouterPaidController } from "./openrouter-paid.controller";
import { OpenRouterService } from "../../common/openrouter.service";

@Module({
  controllers: [OpenRouterController, OpenRouterPaidController],
  providers: [OpenRouterService],
  exports: [OpenRouterService],
})
export class OpenRouterModule {}

