import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CustomPage } from "./entities/custom-page.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CustomPagesService } from "./services/custom-pages.service";
import { CustomPagesController } from "./controllers/custom-pages.controller";
import { PublicCustomPagesController } from "./controllers/public-custom-pages.controller";
import { CustomPagesBotService } from "./services/custom-pages-bot.service";

@Module({
  imports: [TypeOrmModule.forFeature([CustomPage, Bot])],
  providers: [CustomPagesService, CustomPagesBotService],
  controllers: [CustomPagesController, PublicCustomPagesController],
  exports: [CustomPagesService, CustomPagesBotService],
})
export class CustomPagesModule {}
