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
    const { currentNode, bot, message, session } = context;

    this.logger.log("Keyboard node data:", JSON.stringify(currentNode.data));

    // Сохраняем callback данные в переменные сессии, если это callback запрос
    if (message.is_callback && message.callback_query) {
      session.variables["last_callback_data"] = message.callback_query.data;
      session.variables["last_callback_id"] = message.callback_query.id;
      session.variables["callback_timestamp"] = new Date().toISOString();

      // Дополнительная информация о callback
      if (message.callback_query.from) {
        session.variables["callback_user_id"] =
          message.callback_query.from.id?.toString();
        session.variables["callback_username"] =
          message.callback_query.from.username || "";
        session.variables["callback_first_name"] =
          message.callback_query.from.first_name || "";
      }

      // Информация о сообщении с кнопкой
      if (message.callback_query.message) {
        session.variables["callback_message_id"] =
          message.callback_query.message.message_id?.toString();
        session.variables["callback_chat_id"] =
          message.callback_query.message.chat?.id?.toString();
      }

      this.logger.log(
        `Callback данные сохранены: ${message.callback_query.data}`
      );
      this.logger.log(`Callback ID: ${message.callback_query.id}`);
      this.logger.log(
        `Callback от пользователя: ${message.callback_query.from?.id}`
      );
    }

    // Получаем текст сообщения из правильного поля
    const rawMessageText =
      currentNode.data?.messageText ||
      currentNode.data?.text ||
      "Выберите опцию:";
    const buttons = currentNode.data?.buttons || [];
    const isInline = currentNode.data?.isInline || false;
    const parseMode = currentNode.data?.parseMode;

    // Валидация кнопок
    if (!Array.isArray(buttons)) {
      this.logger.error("Кнопки должны быть массивом");
      throw new Error("Invalid buttons format: expected array");
    }

    // Фильтруем валидные кнопки
    const validButtons = buttons.filter((button) => {
      if (!button || typeof button !== "object") {
        this.logger.warn(
          "Пропускаем невалидную кнопку:",
          JSON.stringify(button)
        );
        return false;
      }
      if (!button.text || typeof button.text !== "string") {
        this.logger.warn(
          "Пропускаем кнопку без текста:",
          JSON.stringify(button)
        );
        return false;
      }
      return true;
    });

    if (validButtons.length === 0) {
      this.logger.warn(
        "Нет валидных кнопок, отправляем сообщение без клавиатуры"
      );
    }

    // Подставляем переменные в текст сообщения
    const messageText = this.substituteVariables(rawMessageText, context);

    // Подставляем переменные в текст кнопок
    const processedButtons = validButtons.map((button) => ({
      ...button,
      text: this.substituteVariables(button.text, context),
      callbackData: button.callbackData
        ? this.substituteVariables(button.callbackData, context)
        : undefined,
      url: button.url
        ? this.substituteVariables(button.url, context)
        : undefined,
      webApp: button.webApp
        ? this.substituteVariables(button.webApp, context)
        : undefined,
    }));

    this.logger.log("Keyboard buttons:", JSON.stringify(processedButtons));
    this.logger.log("Is inline:", String(isInline));
    this.logger.log("Parse mode:", parseMode || "не указан");
    this.logger.log(`Исходный текст: "${rawMessageText}"`);
    this.logger.log(`Обработанный текст: "${messageText}"`);

    // Создаем клавиатуру
    let telegramKeyboard;
    if (processedButtons.length > 0) {
      if (isInline) {
        telegramKeyboard = {
          inline_keyboard: processedButtons.map((button) => {
            const buttonData: any = {
              text: button.text,
            };

            if (button.callbackData) {
              buttonData.callback_data = button.callbackData;
            } else if (button.url) {
              buttonData.url = button.url;
            } else if (button.webApp) {
              buttonData.web_app = { url: button.webApp };
            } else {
              buttonData.callback_data = button.text;
            }

            return [buttonData];
          }),
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
    }

    // Отправляем сообщение с клавиатурой (если есть) и сохраняем в БД
    const messageOptions: any = {};

    if (processedButtons.length > 0) {
      messageOptions.reply_markup = telegramKeyboard;
    }

    if (parseMode) {
      messageOptions.parse_mode = parseMode;
    }

    await this.sendAndSaveMessage(
      bot,
      message.chat.id,
      messageText,
      messageOptions
    );

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
