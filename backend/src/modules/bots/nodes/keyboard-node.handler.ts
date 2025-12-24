import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import {
  MessageType,
  MessageContentType,
} from "../../../database/entities/message.entity";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

interface KeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  webApp?: string;
}

@Injectable()
export class KeyboardNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "keyboard";
  }

  // Нормализация кнопок - поддержка старого (плоского) и нового (двумерного) формата
  private normalizeButtons(buttons: any): KeyboardButton[][] {
    if (!buttons || !Array.isArray(buttons)) return [];

    // Проверяем, является ли это уже двумерным массивом
    if (buttons.length > 0 && Array.isArray(buttons[0])) {
      return buttons as KeyboardButton[][];
    }

    // Конвертируем плоский массив - каждая кнопка в отдельном ряду (старый формат)
    return (buttons as KeyboardButton[]).map((btn) => [btn]);
  }

  // Получить плоский список кнопок из двумерного массива
  private flattenButtons(buttonRows: KeyboardButton[][]): KeyboardButton[] {
    return buttonRows.flat();
  }

  // Вспомогательная функция для отправки сообщения с клавиатурой (с поддержкой изображений)
  private async sendMessageWithKeyboard(
    bot: any,
    chatId: string,
    messageText: string,
    imageUrl: string | undefined,
    messageOptions: any,
    processedFlatButtons: KeyboardButton[]
  ): Promise<any> {
    if (imageUrl) {
      return await this.sendAndSavePhoto(bot, chatId, imageUrl, {
        caption: messageText || undefined,
        parse_mode: messageText ? messageOptions.parse_mode : undefined,
        reply_markup: messageOptions.reply_markup,
      });
    } else {
      const decryptedToken = this.botsService.decryptToken(bot.token);

      // Проверяем длину сообщения и выбираем подходящий метод отправки
      if (messageText.length > 4096) {
        // Для длинных сообщений используем sendLongMessage напрямую
        const messageResults = await this.telegramService.sendLongMessage(
          decryptedToken,
          chatId,
          messageText,
          messageOptions
        );

        if (messageResults.length > 0) {
          // Сохраняем первое сообщение в БД (клавиатура будет на последнем автоматически)
          const firstMessage = messageResults[0];
          const processedKeyboard = messageOptions.reply_markup
            ? {
                type: messageOptions.reply_markup.inline_keyboard
                  ? ("inline" as const)
                  : ("reply" as const),
                buttons: processedFlatButtons,
              }
            : null;

          await this.messagesService.create({
            botId: bot.id,
            telegramMessageId: firstMessage.message_id,
            telegramChatId: chatId,
            telegramUserId: bot.id,
            type: MessageType.OUTGOING,
            contentType: MessageContentType.TEXT,
            text: messageText,
            keyboard: processedKeyboard,
            metadata: {
              firstName: bot.name || "Bot",
              lastName: "",
              username: bot.username,
              isBot: true,
            },
            isProcessed: true,
            processedAt: new Date(),
          });
        }

        return messageResults.length > 0 ? messageResults[0] : null;
      } else {
        // Для обычных сообщений используем обычный sendMessage с последующим сохранением
        const telegramResponse = await this.telegramService.sendMessage(
          decryptedToken,
          chatId,
          messageText,
          messageOptions
        );

        if (telegramResponse) {
          // Сохраняем сообщение в БД
          const processedKeyboard = messageOptions.reply_markup
            ? {
                type: messageOptions.reply_markup.inline_keyboard
                  ? ("inline" as const)
                  : ("reply" as const),
                buttons: processedFlatButtons,
              }
            : null;

          await this.messagesService.create({
            botId: bot.id,
            telegramMessageId: telegramResponse.message_id,
            telegramChatId: chatId,
            telegramUserId: bot.id,
            type: MessageType.OUTGOING,
            contentType: MessageContentType.TEXT,
            text: messageText,
            keyboard: processedKeyboard,
            metadata: {
              firstName: bot.name || "Bot",
              lastName: "",
              username: bot.username,
              isBot: true,
            },
            isProcessed: true,
            processedAt: new Date(),
          });
        }

        return telegramResponse;
      }
    }
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;

    // Если это callback запрос, сначала проверяем, относится ли он к текущей ноде
    let isCallbackForCurrentKeyboard = false;
    if (message.is_callback && message.callback_query) {
      // Проверяем, есть ли сохраненный message_id для текущей ноды
      const savedMessageId =
        session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`];
      const callbackMessageId =
        message.callback_query.message?.message_id?.toString();

      // Callback относится к текущей ноде только если message_id совпадает
      isCallbackForCurrentKeyboard = callbackMessageId === savedMessageId;

      if (isCallbackForCurrentKeyboard) {
        // Сохраняем callback данные только если они относятся к текущей ноде
        session.variables[`keyboard_${currentNode.nodeId}_last_callback_data`] =
          message.callback_query.data;
        session.variables[`keyboard_${currentNode.nodeId}_last_callback_id`] =
          message.callback_query.id;
        session.variables[`keyboard_${currentNode.nodeId}_callback_timestamp`] =
          new Date().toISOString();

        // Дополнительная информация о callback
        if (message.callback_query.from) {
          session.variables[`keyboard_${currentNode.nodeId}_callback_user_id`] =
            message.callback_query.from.id?.toString();
          session.variables[
            `keyboard_${currentNode.nodeId}_callback_username`
          ] = message.callback_query.from.username || "";
          session.variables[
            `keyboard_${currentNode.nodeId}_callback_first_name`
          ] = message.callback_query.from.first_name || "";
        }

        // Информация о сообщении с кнопкой
        if (message.callback_query.message) {
          session.variables[
            `keyboard_${currentNode.nodeId}_callback_message_id`
          ] = message.callback_query.message.message_id?.toString();
          session.variables[`keyboard_${currentNode.nodeId}_callback_chat_id`] =
            message.callback_query.message.chat?.id?.toString();
        }
      }
    }

    // Получаем текст сообщения из правильного поля
    const rawMessageText =
      currentNode.data?.messageText || currentNode.data?.text;
    const imageUrl = currentNode.data?.image;
    const buttons = currentNode.data?.buttons || [];
    const isInline = currentNode.data?.isInline || false;
    const parseMode = currentNode.data?.parseMode;
    // Опции для Reply Keyboard
    const oneTimeKeyboard = currentNode.data?.oneTimeKeyboard ?? true; // По умолчанию скрывать после нажатия
    const isPersistent = currentNode.data?.isPersistent ?? false; // По умолчанию не постоянная
    const resizeKeyboard = currentNode.data?.resizeKeyboard ?? true; // По умолчанию автоматический размер

    // Нормализуем кнопки (поддержка обоих форматов)
    const buttonRows = this.normalizeButtons(buttons);
    const flatButtons = this.flattenButtons(buttonRows);

    // Валидация кнопок
    if (flatButtons.length === 0) {
      this.logger.warn(
        "Нет валидных кнопок, отправляем сообщение без клавиатуры"
      );
    }

    // Подставляем переменные в текст сообщения
    const messageText = this.substituteVariables(rawMessageText, context);

    // Подставляем переменные в текст кнопок (сохраняем структуру рядов)
    const processedButtonRows = buttonRows
      .map((row) =>
        row
          .filter((button) => button && button.text)
          .map((button) => ({
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
          }))
      )
      .filter((row) => row.length > 0); // Убираем пустые ряды

    const processedFlatButtons = this.flattenButtons(processedButtonRows);

    // Создаем клавиатуру напрямую из двумерного массива
    let telegramKeyboard;
    if (processedFlatButtons.length > 0) {
      if (isInline) {
        telegramKeyboard = {
          inline_keyboard: processedButtonRows.map((row) =>
            row.map((button) => {
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

              return buttonData;
            })
          ),
        };
      } else {
        // Reply Keyboard с настраиваемыми параметрами
        telegramKeyboard = {
          keyboard: processedButtonRows.map((row) =>
            row.map((button) => ({
              text: button.text,
            }))
          ),
          resize_keyboard: resizeKeyboard,
          one_time_keyboard: oneTimeKeyboard,
          is_persistent: isPersistent, // Telegram Bot API 6.7+: клавиатура всегда отображается
        };
      }
    }

    // Отправляем сообщение с клавиатурой (если есть) и сохраняем в БД
    const messageOptions: any = {};

    if (processedFlatButtons.length > 0) {
      messageOptions.reply_markup = telegramKeyboard;
    }

    if (parseMode) {
      messageOptions.parse_mode = parseMode;
    }

    // Если это callback запрос (пользователь нажал кнопку)
    if (message.is_callback && message.callback_query) {
      // Используем результат проверки, выполненной в начале функции
      if (!isCallbackForCurrentKeyboard) {
        // Отправляем сообщение и сохраняем message_id
        const telegramResponse = await this.sendMessageWithKeyboard(
          bot,
          message.chat.id,
          messageText,
          imageUrl,
          messageOptions,
          processedFlatButtons
        );

        if (telegramResponse?.message_id) {
          // Сохраняем message_id отправленного сообщения для текущей ноды
          session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`] =
            telegramResponse.message_id.toString();
        }

        // Проверяем, есть ли хотя бы одна кнопка с callbackData
        const hasCallbackButtons = processedFlatButtons.some(
          (btn) => btn.callbackData || (!btn.url && !btn.webApp)
        );

        if (!hasCallbackButtons && processedFlatButtons.length > 0) {
          await this.moveToNextNodeByOutput(
            context,
            currentNode.nodeId,
            "button-0"
          );
        }
        return;
      }

      // Находим индекс нажатой кнопки
      const pressedButtonData = message.callback_query.data;

      const buttonIndex = processedFlatButtons.findIndex(
        (button) => button.callbackData === pressedButtonData
      );

      // Очищаем callback_query и text из сообщения перед переходом к следующему узлу
      // чтобы следующий узел не пытался обработать этот callback и не получил текст кнопки как ввод пользователя
      const originalCallbackQuery = message.callback_query;
      const originalIsCallback = message.is_callback;
      const originalText = message.text;
      message.callback_query = undefined;
      message.is_callback = false;
      message.text = undefined;

      try {
        if (buttonIndex !== -1) {
          // Переходим к узлу, подключенному к соответствующему выходу
          await this.moveToNextNodeByOutput(
            context,
            currentNode.nodeId,
            `button-${buttonIndex}`
          );
        } else {
          // Если кнопка не найдена, переходим к первому выходу
          await this.moveToNextNodeByOutput(
            context,
            currentNode.nodeId,
            "button-0"
          );
        }
      } finally {
        // Восстанавливаем callback_query на случай, если он нужен для других целей
        // (хотя обычно после обработки он больше не нужен)
        message.callback_query = originalCallbackQuery;
        message.is_callback = originalIsCallback;
        message.text = originalText;
      }
    } else {
      // Если это обычное сообщение
      // Для обычных клавиатур (inline = false) проверяем, соответствует ли текст сообщения кнопке
      if (!isInline && message.text && message.text.trim()) {
        const pressedButtonText = message.text.trim();

        // Находим индекс кнопки по тексту
        const buttonIndex = processedFlatButtons.findIndex(
          (button) => button.text.trim() === pressedButtonText
        );

        if (buttonIndex !== -1) {
          // Нашли кнопку - очищаем текст сообщения перед переходом к следующему узлу
          // чтобы следующий узел не получил текст кнопки как ввод пользователя
          const originalText = message.text;
          message.text = undefined;

          try {
            // Переходим к узлу, подключенному к соответствующему выходу
            await this.moveToNextNodeByOutput(
              context,
              currentNode.nodeId,
              `button-${buttonIndex}`
            );
          } finally {
            // Восстанавливаем текст сообщения на случай, если он нужен для других целей
            message.text = originalText;
          }
          return;
        }
      }

      // Отправляем клавиатуру и ждем выбора пользователя

      // Отправляем сообщение и сохраняем message_id
      const telegramResponse = await this.sendMessageWithKeyboard(
        bot,
        message.chat.id,
        messageText,
        imageUrl,
        messageOptions,
        processedFlatButtons
      );

      if (telegramResponse?.message_id) {
        // Сохраняем message_id отправленного сообщения для текущей ноды
        session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`] =
          telegramResponse.message_id.toString();
      }

      // Проверяем, есть ли хотя бы одна кнопка с callbackData
      // Если все кнопки - URL или webApp, они не генерируют callback,
      // поэтому нужно автоматически перейти к следующему узлу
      const hasCallbackButtons = processedFlatButtons.some(
        (btn) => btn.callbackData || (!btn.url && !btn.webApp)
      );

      if (!hasCallbackButtons && processedFlatButtons.length > 0) {
        // Переходим к первому выходу или default
        await this.moveToNextNodeByOutput(
          context,
          currentNode.nodeId,
          "button-0"
        );
      }
      // Иначе - ждем callback запрос
    }
  }
}
