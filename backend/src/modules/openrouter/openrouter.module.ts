import { Module } from "@nestjs/common";
import { OpenRouterController } from "./openrouter.controller";
import { OpenRouterService } from "../../common/openrouter.service";

@Module({
  controllers: [OpenRouterController],
  providers: [OpenRouterService],
  exports: [OpenRouterService],
})
export class OpenRouterModule {}

