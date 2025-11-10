import { Module } from "@nestjs/common";
import { CloudAiController } from "./cloud-ai.controller";
import { CloudAiService } from "../../common/cloud-ai.service";

@Module({
  controllers: [CloudAiController],
  providers: [CloudAiService],
  exports: [CloudAiService],
})
export class CloudAiModule {}

