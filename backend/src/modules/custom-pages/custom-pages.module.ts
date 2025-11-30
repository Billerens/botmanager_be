import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CustomPage } from "../../database/entities/custom-page.entity";
import { Bot } from "../../database/entities/bot.entity";
import { CustomPagesService } from "./services/custom-pages.service";
import { CustomPagesController } from "./controllers/custom-pages.controller";
import { PublicCustomPagesController } from "./controllers/public-custom-pages.controller";
import { CustomPagesBotService } from "./services/custom-pages-bot.service";
import { UploadModule } from "../upload/upload.module";
import { TelegramModule } from "../telegram/telegram.module";
import { BotsModule } from "../bots/bots.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomPage, Bot]),
    UploadModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => BotsModule),
  ],
  providers: [CustomPagesService, CustomPagesBotService],
  controllers: [CustomPagesController, PublicCustomPagesController],
  exports: [CustomPagesService, CustomPagesBotService],
})
export class CustomPagesModule {}
