import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class MessageNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "message";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, message } = context;

    const rawMessageText = currentNode.data?.text || "";
    const parseMode = currentNode.data?.parseMode || "HTML";
    const imageUrl = currentNode.data?.image;

    // Подставляем переменные в текст сообщения
    const messageText = this.substituteVariables(rawMessageText, context);

    this.logger.log(`=== MESSAGE УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${context.session.userId}`);
    this.logger.log(`Исходный текст: "${rawMessageText}"`);
    this.logger.log(`Обработанный текст: "${messageText}"`);
    this.logger.log(`Изображение: ${imageUrl || "отсутствует"}`);

    // Если есть изображение - отправляем фото с caption
    if (imageUrl) {
      this.logger.log(`Отправляем фото с URL: ${imageUrl}`);
      await this.sendAndSavePhoto(bot, message.chat.id, imageUrl, {
        caption: messageText || undefined,
        parse_mode: messageText ? parseMode : undefined,
      });
    }
    // Если нет изображения, но есть текст - отправляем текстовое сообщение
    else if (messageText) {
      await this.sendAndSaveMessage(bot, message.chat.id, messageText, {
        parse_mode: parseMode,
      });
    }
    // Если нет ни текста, ни изображения - логируем предупреждение
    else {
      this.logger.warn(
        `Message узел ${currentNode.nodeId} не содержит ни текста, ни изображения`
      );
    }

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
