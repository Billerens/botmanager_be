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
    this.logger.log(`Текущий узел в сессии: ${session.currentNodeId}`);

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

    // Если узел был достигнут через переход от другого узла,
    // нужно просто установить его как текущий и ждать следующего сообщения от пользователя
    if (context.reachedThroughTransition) {
      this.logger.log(
        `Узел NEW_MESSAGE достигнут через переход от другого узла. Устанавливаем его как текущий и ждем следующего сообщения.`
      );
      // Узел уже установлен как текущий в moveToNextNode, просто выходим
      // При следующем сообщении от пользователя этот узел будет проверен снова
      return;
    }

    // Если сообщение не соответствует условиям узла, значит узел был достигнут через переход
    // (но флаг не был установлен, что может произойти в некоторых случаях)
    // В этом случае нужно просто установить узел как текущий и ждать следующего сообщения
    if (!messageMatches) {
      this.logger.log(
        `Сообщение не соответствует условиям узла NEW_MESSAGE: ${message.text}. Устанавливаем узел как текущий и ждем следующего сообщения.`
      );
      // Узел уже установлен как текущий в moveToNextNode, просто выходим
      // При следующем сообщении от пользователя этот узел будет проверен снова
      return;
    }

    // Если узел достигнут как начальный (триггер сообщением) И сообщение соответствует условиям
    this.logger.log(
      `Сообщение соответствует условиям узла NEW_MESSAGE: ${message.text}`
    );

    // Переходим к следующим узлам (обрабатываем все выходные связи)
    // moveToNextNode теперь по умолчанию обрабатывает все связи, если они есть
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
