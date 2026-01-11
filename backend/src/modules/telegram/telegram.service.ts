import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { CustomPagesBotService } from "../custom-pages/services/custom-pages-bot.service";

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
  photo?: any[];
  video?: any;
  audio?: any;
  document?: any;
  sticker?: any;
  voice?: any;
  location?: any;
  contact?: any;
  reply_to_message?: TelegramMessage;
  entities?: any[];
  caption?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: any;
  chosen_inline_result?: any;
  callback_query?: {
    id: string;
    from: any;
    message?: TelegramMessage;
    inline_message_id?: string;
    data: string;
  };
}

@Injectable()
export class TelegramService {
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private customPagesBotService: CustomPagesBotService
  ) {
    this.baseUrl = this.configService.get<string>(
      "TELEGRAM_BOT_API_URL",
      "https://api.telegram.org/bot"
    );
  }

  async getBotInfo(token: string): Promise<TelegramBotInfo | null> {
    try {
      const response = await axios.get(`${this.baseUrl}${token}/getMe`);
      return response.data.result;
    } catch (error) {
      console.error("Ошибка получения информации о боте:", error.message);
      console.error(
        "Ошибка получения информации о боте:",
        error.response?.data
      );
      console.error(
        "Ошибка получения информации о боте:",
        `${this.baseUrl}${token}/getMe`
      );

      return null;
    }
  }

  async setWebhook(token: string, botId: string): Promise<boolean> {
    try {
      const webhookUrl = `${this.configService.get("app.webhookBaseUrl")}/telegram/webhook/${botId}`;

      const response = await axios.post(`${this.baseUrl}${token}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      });

      return response.data.ok;
    } catch (error) {
      console.error("Ошибка установки webhook:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        webhookUrl: `${this.configService.get("app.webhookBaseUrl")}/telegram/webhook/${botId}`,
      });
      throw new BadRequestException(
        `Ошибка установки webhook: ${error.response?.data?.description || error.message}`
      );
    }
  }

  async deleteWebhook(token: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}${token}/deleteWebhook`
      );
      return response.data.ok;
    } catch (error) {
      console.error("Ошибка удаления webhook:", error.message);
      return false;
    }
  }

  async setBotCommands(
    token: string,
    bot: Bot,
    shop: Shop | null = null,
    bookingSystem: BookingSystem | null = null
  ): Promise<boolean> {
    try {
      const commands = [
        {
          command: "start",
          description: "Запустить бота",
        },
      ];

      // Добавляем команду магазина если он привязан и команда настроена
      const hasShopCommand = shop && shop.buttonTypes?.includes("command");
      if (hasShopCommand) {
        const commandSettings = shop.buttonSettings?.command;
        commands.push({
          command: "shop",
          description: commandSettings?.description || "🛒 Открыть магазин",
        });
      }

      // Добавляем команду бронирования из BookingSystem (новая архитектура)
      const hasBookingSystemCommand =
        bookingSystem && bookingSystem.buttonTypes?.includes("command");
      if (hasBookingSystemCommand) {
        const commandSettings = bookingSystem.buttonSettings?.command;
        commands.push({
          command: "booking",
          description: commandSettings?.description || "📅 Записаться на прием",
        });
      }

      // Добавляем команды custom pages
      try {
        const pageCommands =
          await this.customPagesBotService.generateBotCommands(bot.id);
        commands.push(...pageCommands);
      } catch (error) {
        console.error(
          `Ошибка при добавлении команд custom pages для бота ${bot.id}:`,
          error.message
        );
      }

      const response = await axios.post(
        `${this.baseUrl}${token}/setMyCommands`,
        {
          commands: commands,
          scope: { type: "default" },
        }
      );

      // Определяем, какой Menu Button должен быть активен
      const hasShopMenuButton =
        shop && shop.buttonTypes?.includes("menu_button");
      const hasBookingSystemMenuButton =
        bookingSystem && bookingSystem.buttonTypes?.includes("menu_button");

      if (hasShopMenuButton) {
        await this.setMenuButton(token, shop);
      } else if (hasBookingSystemMenuButton) {
        await this.setBookingSystemMenuButton(token, bookingSystem);
      } else {
        // Если ни один Menu Button не включен, очищаем его
        await this.clearMenuButton(token);
      }

      return response.data.ok;
    } catch (error) {
      console.error("Ошибка установки команд бота:", {
        message: error.message,
        response: error.response?.data,
      });
      return false;
    }
  }

  /**
   * Устанавливает Menu Button для магазина
   */
  private async setMenuButton(token: string, shop: Shop): Promise<void> {
    try {
      // Проверяем, что токен не пустой
      if (!token || token.trim() === "") {
        console.error("Ошибка установки Menu Button: пустой токен");
        return;
      }

      const buttonText = shop.buttonSettings?.menu_button?.text || "🛒 Магазин";

      const shopUrl =
        shop.url ||
        `${process.env.FRONTEND_URL || "https://botmanagertest.online"}/shop/${shop.id}`;

      await axios.post(`${this.baseUrl}${token}/setChatMenuButton`, {
        menu_button: {
          type: "web_app",
          text: buttonText,
          web_app: {
            url: shopUrl,
          },
        },
      });
    } catch (error) {
      console.error("Ошибка установки Menu Button:", error.message);
    }
  }

  /**
   * Устанавливает Menu Button для системы бронирования (новая архитектура)
   */
  private async setBookingSystemMenuButton(
    token: string,
    bookingSystem: BookingSystem
  ): Promise<void> {
    try {
      if (!token || token.trim() === "") {
        console.error(
          "Ошибка установки BookingSystem Menu Button: пустой токен"
        );
        return;
      }

      const buttonText =
        bookingSystem.buttonSettings?.menu_button?.text || "📅 Записаться";

      const bookingUrl =
        bookingSystem.url ||
        `${process.env.FRONTEND_URL || "https://botmanagertest.online"}/booking-system/${bookingSystem.id}`;

      await axios.post(`${this.baseUrl}${token}/setChatMenuButton`, {
        menu_button: {
          type: "web_app",
          text: buttonText,
          web_app: {
            url: bookingUrl,
          },
        },
      });
    } catch (error) {
      console.error(
        "Ошибка установки BookingSystem Menu Button:",
        error.message
      );
    }
  }

  /**
   * Очищает Menu Button (удаляет его)
   */
  private async clearMenuButton(token: string): Promise<void> {
    try {
      // Проверяем, что токен не пустой
      if (!token || token.trim() === "") {
        console.error("Ошибка очистки Menu Button: пустой токен");
        return;
      }

      // Для очистки Menu Button передаем запрос без тела
      await axios.post(`${this.baseUrl}${token}/setChatMenuButton`);
    } catch (error) {
      console.error("Ошибка очистки Menu Button:", error.message);
    }
  }

  async sendMessage(
    token: string,
    chatId: string,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    } = {}
  ): Promise<any> {
    try {
      // Очищаем HTML если используется HTML parse_mode
      let processedText = text;

      // if (options.parse_mode === "HTML") {
      //   processedText = this.sanitizeHtmlForTelegram(text);
      // }

      const url = `${this.baseUrl}${token}/sendMessage`;

      const response = await axios.post(url, {
        chat_id: chatId,
        text: processedText,
        ...options,
      });

      return response.data.ok ? response.data.result : null;
    } catch (error) {
      // Проверяем, является ли ошибка "text is too long"
      if (error.response?.data?.description?.includes("text is too long")) {
        // Для длинных сообщений отключаем parse_mode, так как разбитые части могут содержать невалидную разметку
        const plainOptions = { ...options };
        delete plainOptions.parse_mode;

        const results = await this.sendLongMessage(
          token,
          chatId,
          text,
          plainOptions
        );
        return results.length > 0 ? results[0] : null;
      }

      // Проверяем, является ли ошибка связана с парсингом (HTML/Markdown)
      if (
        error.response?.data?.description?.includes("can't parse entities") ||
        error.response?.data?.description?.includes("Unsupported start tag") ||
        error.response?.data?.description?.includes("Bad Request: can't parse")
      ) {
        // Отправляем без parse_mode
        const plainOptions = { ...options };
        delete plainOptions.parse_mode;

        return await this.sendMessage(token, chatId, text, plainOptions);
      }

      console.error(
        "Ошибка отправки сообщения:",
        error.response?.data?.description || error.message
      );
      return null;
    }
  }

  /**
   * Отправляет длинное сообщение, автоматически разбивая его на части
   * если текст превышает лимит Telegram (4096 символов)
   */
  async sendLongMessage(
    token: string,
    chatId: string,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    } = {}
  ): Promise<any[]> {
    // Очищаем HTML если используется HTML parse_mode
    let processedText = text;

    // if (options.parse_mode === "HTML") {
    //   processedText = this.sanitizeHtmlForTelegram(text);
    // }

    const MAX_MESSAGE_LENGTH = 4096;
    const results: any[] = [];

    if (processedText.length <= MAX_MESSAGE_LENGTH) {
      // Если текст помещается в одно сообщение, отправляем обычным способом
      const result = await this.sendMessage(
        token,
        chatId,
        processedText,
        options
      );
      return result ? [result] : [];
    }

    // Разбиваем текст на части по границам слов
    const parts = this.splitTextIntoParts(processedText, MAX_MESSAGE_LENGTH);

    // Отправляем каждую часть как отдельное сообщение
    // Для разбитых сообщений отключаем parse_mode, так как части могут содержать невалидную разметку
    const plainOptions = {
      disable_web_page_preview: options.disable_web_page_preview,
    };

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      // Reply markup и reply_to_message_id применяем только к последнему сообщению
      const partOptions = isLastPart
        ? {
            ...plainOptions,
            reply_markup: options.reply_markup,
            reply_to_message_id: options.reply_to_message_id,
          }
        : plainOptions;

      const result = await this.sendMessage(token, chatId, part, partOptions);
      if (result) {
        results.push(result);
      }

      // Небольшая задержка между отправкой частей, чтобы избежать rate limiting
      if (i < parts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Очищает HTML текст, оставляя только теги, поддерживаемые Telegram Bot API
   * Поддерживаемые теги: b, i, u, s, a, code, pre
   */
  sanitizeHtmlForTelegram(html: string): string {
    if (!html) return html;

    // Удаляем DOCTYPE и другие неподдерживаемые конструкции
    let sanitized = html.replace(/<!DOCTYPE[^>]*>/gi, "");
    sanitized = sanitized.replace(/<html[^>]*>/gi, "");
    sanitized = sanitized.replace(/<\/html>/gi, "");
    sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
    sanitized = sanitized.replace(/<body[^>]*>/gi, "");
    sanitized = sanitized.replace(/<\/body>/gi, "");
    sanitized = sanitized.replace(/<meta[^>]*>/gi, "");
    sanitized = sanitized.replace(/<link[^>]*>/gi, "");
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Удаляем все неподдерживаемые теги, но сохраняем их содержимое
    sanitized = sanitized.replace(
      /<\/?(?!\/?(b|i|u|s|a|code|pre)\b)[^>]*>/gi,
      ""
    );

    // Удаляем лишние пробелы в начале и конце
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Разбивает текст на части по границам слов, не превышая максимальную длину
   */
  private splitTextIntoParts(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    let currentPart = "";

    // Разбиваем текст на слова
    const words = text.split(" ");

    for (const word of words) {
      // Если добавление слова превысит лимит
      if ((currentPart + " " + word).length > maxLength) {
        if (currentPart.length > 0) {
          // Сохраняем текущую часть
          parts.push(currentPart.trim());
          currentPart = word;
        } else {
          // Если даже одно слово превышает лимит, разбиваем его принудительно
          parts.push(word.substring(0, maxLength));
          currentPart = word.substring(maxLength);
        }
      } else {
        // Добавляем слово к текущей части
        currentPart += (currentPart.length > 0 ? " " : "") + word;
      }
    }

    // Добавляем последнюю часть
    if (currentPart.length > 0) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  async sendPhoto(
    token: string,
    chatId: string,
    photo: string | Buffer,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {}
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);

      if (Buffer.isBuffer(photo)) {
        // Если это Buffer (файл в памяти) - передаем напрямую
        formData.append("photo", photo, { filename: "photo.jpg" });
      } else if (typeof photo === "string") {
        // Если это строка
        if (photo.startsWith("http://") || photo.startsWith("https://")) {
          // Если это URL - Telegram может скачать файл сам
          formData.append("photo", photo);
        } else if (fs.existsSync(photo)) {
          // Если это путь к локальному файлу - читаем через stream
          formData.append("photo", fs.createReadStream(photo));
        } else {
          // Если это file_id или другой идентификатор Telegram
          formData.append("photo", photo);
        }
      } else {
        throw new Error("Неподдерживаемый тип данных для фото");
      }

      if (options.caption) {
        formData.append("caption", options.caption);
      }
      if (options.parse_mode) {
        formData.append("parse_mode", options.parse_mode);
      }
      if (options.reply_markup) {
        formData.append("reply_markup", JSON.stringify(options.reply_markup));
      }
      if (options.reply_to_message_id) {
        formData.append(
          "reply_to_message_id",
          options.reply_to_message_id.toString()
        );
      }

      const response = await axios.post(
        `${this.baseUrl}${token}/sendPhoto`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.ok ? response.data.result : null;
    } catch (error) {
      console.error("Ошибка отправки фото:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      return null;
    }
  }

  async sendDocument(
    token: string,
    chatId: string,
    document: string | Buffer,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {}
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);

      if (Buffer.isBuffer(document)) {
        formData.append("document", document, { filename: "document.pdf" });
      } else {
        formData.append("document", document);
      }

      if (options.caption) {
        formData.append("caption", options.caption);
      }
      if (options.parse_mode) {
        formData.append("parse_mode", options.parse_mode);
      }
      if (options.reply_markup) {
        formData.append("reply_markup", JSON.stringify(options.reply_markup));
      }
      if (options.reply_to_message_id) {
        formData.append(
          "reply_to_message_id",
          options.reply_to_message_id.toString()
        );
      }

      const response = await axios.post(
        `${this.baseUrl}${token}/sendDocument`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.ok ? response.data.result : null;
    } catch (error) {
      console.error("Ошибка отправки документа:", error.message);
      return null;
    }
  }

  /**
   * Отправляет действие чата (typing, upload_photo и т.д.)
   * Статус "typing" автоматически сбрасывается через 5 секунд
   */
  async sendChatAction(
    token: string,
    chatId: string,
    action:
      | "typing"
      | "upload_photo"
      | "record_video"
      | "upload_video"
      | "record_voice"
      | "upload_voice"
      | "upload_document"
      | "find_location"
      | "record_video_note"
      | "upload_video_note"
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}${token}/sendChatAction`,
        {
          chat_id: chatId,
          action,
        }
      );
      return response.data.ok;
    } catch (error) {
      console.error("Ошибка отправки действия чата:", error.message);
      return false;
    }
  }

  async answerCallbackQuery(
    token: string,
    callbackQueryId: string,
    options: {
      text?: string;
      show_alert?: boolean;
      url?: string;
      cache_time?: number;
    } = {}
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}${token}/answerCallbackQuery`,
        {
          callback_query_id: callbackQueryId,
          ...options,
        }
      );

      return response.data.ok;
    } catch (error) {
      console.error("Ошибка ответа на callback query:", error.message);
      return false;
    }
  }

  async editMessageText(
    token: string,
    chatId: string,
    messageId: number,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    } = {}
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}${token}/editMessageText`,
        {
          chat_id: chatId,
          message_id: messageId,
          text,
          ...options,
        }
      );

      return response.data.ok;
    } catch (error) {
      console.error("Ошибка редактирования сообщения:", error.message);
      return false;
    }
  }

  async deleteMessage(
    token: string,
    chatId: string,
    messageId: number
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}${token}/deleteMessage`,
        {
          chat_id: chatId,
          message_id: messageId,
        }
      );

      return response.data.ok;
    } catch (error) {
      console.error("Ошибка удаления сообщения:", error.message);
      return false;
    }
  }

  async getFile(
    token: string,
    fileId: string
  ): Promise<{ file_path: string } | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}${token}/getFile?file_id=${fileId}`
      );
      return response.data.result;
    } catch (error) {
      console.error("Ошибка получения файла:", error.message);
      return null;
    }
  }

  async downloadFile(token: string, filePath: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(
        `https://api.telegram.org/file/bot${token}/${filePath}`,
        {
          responseType: "arraybuffer",
        }
      );
      return Buffer.from(response.data);
    } catch (error) {
      console.error("Ошибка скачивания файла:", error.message);
      return null;
    }
  }

  getFileStream(token: string, filePath: string): Promise<any> {
    // Возвращаем stream для проксирования файла без загрузки в память
    return axios.get(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      responseType: "stream",
    });
  }
}
