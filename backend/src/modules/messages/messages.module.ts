import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { Message } from "../../database/entities/message.entity";
import { Bot } from "../../database/entities/bot.entity";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [TypeOrmModule.forFeature([Message, Bot]), TelegramModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
