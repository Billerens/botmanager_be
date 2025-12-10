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

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;

    this.logger.log("Keyboard node data:", JSON.stringify(currentNode.data));

    // Если это callback запрос, сначала проверяем, относится ли он к текущей ноде
    let isCallbackForCurrentKeyboard = false;
    if (message.is_callback && message.callback_query) {
      // Проверяем, есть ли сохраненный message_id для текущей ноды
      const savedMessageId =
        session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`];
      const callbackMessageId =
        message.callback_query.message?.message_id?.toString();

      this.logger.log(
        `Проверка callback: сохраненный message_id=${savedMessageId}, callback message_id=${callbackMessageId}`
      );

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

        this.logger.log(
          `Callback данные сохранены для ноды ${currentNode.nodeId}: ${message.callback_query.data}`
        );
        this.logger.log(`Callback ID: ${message.callback_query.id}`);
        this.logger.log(
          `Callback от пользователя: ${message.callback_query.from?.id}`
        );
      } else {
        this.logger.log(
          `Callback не относится к текущей ноде ${currentNode.nodeId}, пропускаем сохранение данных`
        );
      }
    }

    // Получаем текст сообщения из правильного поля
    const rawMessageText =
      currentNode.data?.messageText || currentNode.data?.text;
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

    this.logger.log(
      `Кнопок рядов: ${buttonRows.length}, всего кнопок: ${flatButtons.length}`
    );

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

    this.logger.log("Keyboard buttons:", JSON.stringify(processedButtonRows));
    this.logger.log("Is inline:", String(isInline));
    this.logger.log("Parse mode:", parseMode || "не указан");
    this.logger.log(`Исходный текст: "${rawMessageText}"`);
    this.logger.log(`Обработанный текст: "${messageText}"`);

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
        this.logger.log(
          `Callback_query не относится к текущему keyboard узлу ${currentNode.nodeId}, отправляем клавиатуру`
        );

        // Отправляем сообщение и сохраняем message_id
        const decryptedToken = this.botsService.decryptToken(bot.token);

        const telegramResponse = await this.telegramService.sendMessage(
          decryptedToken,
          message.chat.id,
          messageText,
          messageOptions
        );

        if (telegramResponse?.message_id) {
          // Сохраняем message_id отправленного сообщения для текущей ноды
          session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`] =
            telegramResponse.message_id.toString();

          // Сохраняем сообщение в БД
          let processedKeyboard = null;
          if (messageOptions.reply_markup) {
            processedKeyboard = {
              type: messageOptions.reply_markup.inline_keyboard
                ? "inline"
                : "reply",
              buttons: processedFlatButtons,
            };
          }

          await this.messagesService.create({
            botId: bot.id,
            telegramMessageId: telegramResponse.message_id,
            telegramChatId: message.chat.id,
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

          this.logger.log(
            `Сообщение отправлено, message_id сохранен: ${telegramResponse.message_id}`
          );
        }

        // Проверяем, есть ли хотя бы одна кнопка с callbackData
        const hasCallbackButtons = processedFlatButtons.some(
          (btn) => btn.callbackData || (!btn.url && !btn.webApp)
        );

        if (!hasCallbackButtons && processedFlatButtons.length > 0) {
          this.logger.log(
            `Все кнопки URL/webApp без callback - автоматически переходим к следующему узлу`
          );
          await this.moveToNextNodeByOutput(
            context,
            currentNode.nodeId,
            "button-0"
          );
        } else {
          this.logger.log(`Keyboard узел завершен, ожидаем выбор пользователя`);
        }
        return;
      }

      // Находим индекс нажатой кнопки
      const pressedButtonData = message.callback_query.data;
      this.logger.log(`Нажата кнопка с данными: ${pressedButtonData}`);
      this.logger.log(
        `Доступные кнопки: ${JSON.stringify(processedFlatButtons.map((b) => ({ text: b.text, callbackData: b.callbackData })))}`
      );

      const buttonIndex = processedFlatButtons.findIndex(
        (button) => button.callbackData === pressedButtonData
      );

      this.logger.log(`Найден индекс кнопки: ${buttonIndex}`);

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
          this.logger.log(`Переходим к выходу button-${buttonIndex}`);
          await this.moveToNextNodeByOutput(
            context,
            currentNode.nodeId,
            `button-${buttonIndex}`
          );
        } else {
          // Если кнопка не найдена, переходим к первому выходу
          this.logger.warn(
            `Кнопка с данными ${pressedButtonData} не найдена, переходим к button-0`
          );
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
      this.logger.log(`Получено обычное сообщение: "${message.text}"`);

      // Для обычных клавиатур (inline = false) проверяем, соответствует ли текст сообщения кнопке
      if (!isInline && message.text && message.text.trim()) {
        const pressedButtonText = message.text.trim();
        this.logger.log(
          `Проверяем, соответствует ли текст "${pressedButtonText}" кнопке`
        );

        // Находим индекс кнопки по тексту
        const buttonIndex = processedFlatButtons.findIndex(
          (button) => button.text.trim() === pressedButtonText
        );

        this.logger.log(`Найден индекс кнопки: ${buttonIndex}`);

        if (buttonIndex !== -1) {
          // Нашли кнопку - очищаем текст сообщения перед переходом к следующему узлу
          // чтобы следующий узел не получил текст кнопки как ввод пользователя
          const originalText = message.text;
          message.text = undefined;

          try {
            // Переходим к узлу, подключенному к соответствующему выходу
            this.logger.log(
              `Найдена кнопка "${pressedButtonText}", переходим к выходу button-${buttonIndex}`
            );
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
        } else {
          // Кнопка не найдена - отправляем клавиатуру и ждем выбора
          this.logger.log(
            `Кнопка с текстом "${pressedButtonText}" не найдена, отправляем клавиатуру`
          );
        }
      }

      // Отправляем клавиатуру и ждем выбора пользователя
      this.logger.log(`Отправляем клавиатуру и ждем выбора пользователя`);

      // Отправляем сообщение и сохраняем message_id
      const decryptedToken = this.botsService.decryptToken(bot.token);
      const telegramResponse = await this.telegramService.sendMessage(
        decryptedToken,
        message.chat.id,
        messageText,
        messageOptions
      );

      if (telegramResponse?.message_id) {
        // Сохраняем message_id отправленного сообщения для текущей ноды
        session.variables[`keyboard_${currentNode.nodeId}_sent_message_id`] =
          telegramResponse.message_id.toString();

        // Сохраняем сообщение в БД
        let processedKeyboard = null;
        if (messageOptions.reply_markup) {
          processedKeyboard = {
            type: messageOptions.reply_markup.inline_keyboard
              ? "inline"
              : "reply",
            buttons: processedFlatButtons,
          };
        }

        await this.messagesService.create({
          botId: bot.id,
          telegramMessageId: telegramResponse.message_id,
          telegramChatId: message.chat.id,
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

        this.logger.log(
          `Сообщение отправлено, message_id сохранен: ${telegramResponse.message_id}`
        );
      }

      // Проверяем, есть ли хотя бы одна кнопка с callbackData
      // Если все кнопки - URL или webApp, они не генерируют callback,
      // поэтому нужно автоматически перейти к следующему узлу
      const hasCallbackButtons = processedFlatButtons.some(
        (btn) => btn.callbackData || (!btn.url && !btn.webApp)
      );

      if (!hasCallbackButtons && processedFlatButtons.length > 0) {
        this.logger.log(
          `Все кнопки URL/webApp без callback - автоматически переходим к следующему узлу`
        );
        // Переходим к первому выходу или default
        await this.moveToNextNodeByOutput(
          context,
          currentNode.nodeId,
          "button-0"
        );
      } else {
        // НЕ переходим к следующему узлу - ждем callback запрос
        this.logger.log(`Keyboard узел завершен, ожидаем выбор пользователя`);
      }
    }
  }
}
