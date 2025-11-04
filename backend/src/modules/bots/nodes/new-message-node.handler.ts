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
export class NewMessageNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "new_message";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, message } = context;

    this.logger.log(`=== ВЫПОЛНЕНИЕ NEW_MESSAGE УЗЛА ===`);
    this.logger.log(`Узел: ${currentNode.nodeId}`);
    this.logger.log(`Сообщение: "${message.text}"`);

    if (!currentNode?.data?.newMessage) {
      this.logger.warn("Данные нового сообщения не найдены");
      return;
    }

    const newMessageData = currentNode.data.newMessage;
    const { text, contentType, caseSensitive } = newMessageData;

    this.logger.log(`Данные узла: ${JSON.stringify(newMessageData)}`);

    // Проверяем соответствие сообщения условиям узла
    let messageMatches = true;

    // Проверяем текст сообщения
    if (text && text.trim() !== "") {
      const messageText = message.text || "";
      const filterText = caseSensitive ? text : text.toLowerCase();
      const userText = caseSensitive ? messageText : messageText.toLowerCase();

      this.logger.log(`Проверка текста: "${userText}" vs "${filterText}"`);

      if (userText !== filterText) {
        this.logger.log(`Текст не совпадает`);
        messageMatches = false;
      }
    }

    // Проверяем тип контента
    if (contentType && contentType !== "text") {
      const messageContentType = this.getMessageContentType(message);
      this.logger.log(
        `Проверка типа контента: "${messageContentType}" vs "${contentType}"`
      );

      if (messageContentType !== contentType) {
        this.logger.log(`Тип контента не совпадает`);
        messageMatches = false;
      }
    }

    if (!messageMatches) {
      this.logger.log(
        `Сообщение не соответствует условиям узла NEW_MESSAGE: ${message.text}`
      );
      return;
    }

    this.logger.log(
      `Сообщение соответствует условиям узла NEW_MESSAGE: ${message.text}`
    );

    // Переходим к следующим узлам (обрабатываем все выходные связи)
    // moveToNextNode теперь по умолчанию обрабатывает все связи, если они есть
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
