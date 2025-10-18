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
export class KeyboardNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "keyboard";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, message } = context;

    this.logger.log("Keyboard node data:", JSON.stringify(currentNode.data));

    const rawMessageText = currentNode.data?.text || "Выберите опцию:";
    const buttons = currentNode.data?.buttons || [];
    const isInline = currentNode.data?.isInline || false;

    // Подставляем переменные в текст сообщения
    const messageText = this.substituteVariables(rawMessageText, context);

    // Подставляем переменные в текст кнопок
    const processedButtons = buttons.map((button) => ({
      ...button,
      text: this.substituteVariables(button.text, context),
      callbackData: this.substituteVariables(
        button.callbackData || button.text,
        context
      ),
    }));

    this.logger.log("Keyboard buttons:", JSON.stringify(processedButtons));
    this.logger.log("Is inline:", String(isInline));
    this.logger.log(`Исходный текст: "${rawMessageText}"`);
    this.logger.log(`Обработанный текст: "${messageText}"`);

    // Создаем клавиатуру
    let telegramKeyboard;
    if (isInline) {
      telegramKeyboard = {
        inline_keyboard: processedButtons.map((button) => [
          {
            text: button.text,
            callback_data: button.callbackData || button.text,
          },
        ]),
      };
    } else {
      telegramKeyboard = {
        keyboard: processedButtons.map((button) => [
          {
            text: button.text,
          },
        ]),
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    }

    // Отправляем сообщение с клавиатурой и сохраняем в БД
    await this.sendAndSaveMessage(bot, message.chat.id, messageText, {
      reply_markup: telegramKeyboard,
    });

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
