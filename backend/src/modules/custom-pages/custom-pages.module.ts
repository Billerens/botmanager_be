import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CustomPage } from "../../database/entities/custom-page.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { CustomPagesService } from "./services/custom-pages.service";
import { CustomPagesController } from "./controllers/custom-pages.controller";
import { PublicCustomPagesController } from "./controllers/public-custom-pages.controller";
import { CustomPagesBotService } from "./services/custom-pages-bot.service";
import { UploadModule } from "../upload/upload.module";
import { TelegramModule } from "../telegram/telegram.module";
import { BotsModule } from "../bots/bots.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { CustomDomainsModule } from "../custom-domains/custom-domains.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomPage, Bot, Shop]),
    UploadModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => BotsModule),
    WebSocketModule,
    forwardRef(() => CustomDomainsModule),
  ],
  providers: [CustomPagesService, CustomPagesBotService],
  controllers: [CustomPagesController, PublicCustomPagesController],
  exports: [CustomPagesService, CustomPagesBotService],
})
export class CustomPagesModule {}
