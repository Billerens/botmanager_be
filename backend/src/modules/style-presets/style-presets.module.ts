import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StylePreset } from "../../database/entities/style-preset.entity";
import { StylePresetsService } from "./style-presets.service";
import { StylePresetsController } from "./style-presets.controller";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [TypeOrmModule.forFeature([StylePreset]), WebSocketModule],
  controllers: [StylePresetsController],
  providers: [StylePresetsService],
  exports: [StylePresetsService],
})
export class StylePresetsModule {}
