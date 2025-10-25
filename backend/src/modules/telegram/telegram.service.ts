import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import FormData from "form-data";
import { Bot } from "../../database/entities/bot.entity";

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

  constructor(private configService: ConfigService) {
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

      console.log("Setting webhook:", {
        token: token.substring(0, 10) + "...",
        botId,
        webhookUrl,
        baseUrl: this.baseUrl,
      });

      const response = await axios.post(`${this.baseUrl}${token}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      });

      console.log("Webhook response:", response.data);
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

  async setBotCommands(token: string, bot: Bot): Promise<boolean> {
    try {
      const commands = [
        {
          command: "start",
          description: "Запустить бота",
        },
      ];

      // Добавляем команду магазина если он включен и команда настроена
      if (bot.isShop && bot.shopButtonTypes?.includes("command")) {
        const commandSettings = bot.shopButtonSettings?.command;
        commands.push({
          command: "shop",
          description: commandSettings?.description || "🛒 Открыть магазин",
        });
        console.log(
          `Добавлена команда /shop для бота ${bot.id} (isShop=${bot.isShop}, shopButtonTypes=${JSON.stringify(bot.shopButtonTypes)})`
        );
      } else {
        console.log(
          `Команда /shop НЕ добавлена для бота ${bot.id}: isShop=${bot.isShop}, shopButtonTypes=${JSON.stringify(bot.shopButtonTypes)}`
        );
      }

      // Добавляем команду бронирования если оно включено и команда настроена
      if (bot.isBookingEnabled && bot.bookingButtonTypes?.includes("command")) {
        const commandSettings = bot.bookingButtonSettings?.command;
        commands.push({
          command: "booking",
          description: commandSettings?.description || "📅 Записаться на прием",
        });
        console.log(
          `Добавлена команда /booking для бота ${bot.id} (isBookingEnabled=${bot.isBookingEnabled}, bookingButtonTypes=${JSON.stringify(bot.bookingButtonTypes)})`
        );
      } else {
        console.log(
          `Команда /booking НЕ добавлена для бота ${bot.id}: isBookingEnabled=${bot.isBookingEnabled}, bookingButtonTypes=${JSON.stringify(bot.bookingButtonTypes)}`
        );
      }

      const response = await axios.post(
        `${this.baseUrl}${token}/setMyCommands`,
        {
          commands: commands,
        }
      );

      console.log("Bot commands установлены:", commands);

      // Устанавливаем Menu Button если он настроен
      if (bot.isShop && bot.shopButtonTypes?.includes("menu_button")) {
        await this.setMenuButton(token, bot);
      }

      // Устанавливаем Menu Button для бронирования если он настроен
      if (
        bot.isBookingEnabled &&
        bot.bookingButtonTypes?.includes("menu_button")
      ) {
        await this.setBookingMenuButton(token, bot);
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
  private async setMenuButton(token: string, bot: Bot): Promise<void> {
    try {
      const buttonText =
        bot.shopButtonSettings?.menu_button?.text || "🛒 Магазин";

      const shopUrl =
        bot.shopUrl ||
        `${process.env.FRONTEND_URL || "https://botmanagertest.online"}/shop/${bot.id}`;

      await axios.post(`${this.baseUrl}${token}/setChatMenuButton`, {
        menu_button: {
          type: "web_app",
          text: buttonText,
          web_app: {
            url: shopUrl,
          },
        },
      });

      console.log("Menu button set successfully");
    } catch (error) {
      console.error("Ошибка установки Menu Button:", error.message);
    }
  }

  /**
   * Устанавливает Menu Button для бронирования
   */
  private async setBookingMenuButton(token: string, bot: Bot): Promise<void> {
    try {
      const buttonText =
        bot.bookingButtonSettings?.menu_button?.text || "📅 Записаться";

      const bookingUrl =
        bot.bookingUrl ||
        `${process.env.FRONTEND_URL || "https://botmanagertest.online"}/booking/${bot.id}`;

      await axios.post(`${this.baseUrl}${token}/setChatMenuButton`, {
        menu_button: {
          type: "web_app",
          text: buttonText,
          web_app: {
            url: bookingUrl,
          },
        },
      });

      console.log("Booking Menu button set successfully");
    } catch (error) {
      console.error("Ошибка установки Booking Menu Button:", error.message);
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
      const url = `${this.baseUrl}${token}/sendMessage`;
      console.log(`Отправляем сообщение на URL: ${url}`);
      console.log(`Данные:`, {
        chat_id: chatId,
        text: text.substring(0, 50) + "...",
        ...options,
      });

      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        ...options,
      });

      console.log(`Ответ Telegram API:`, response.data);
      return response.data.ok ? response.data.result : null;
    } catch (error) {
      console.error("Ошибка отправки сообщения:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: `${this.baseUrl}${token.substring(0, 10)}.../sendMessage`,
        chatId,
      });
      return null;
    }
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
        formData.append("photo", photo, { filename: "photo.jpg" });
      } else {
        formData.append("photo", photo);
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
      console.error("Ошибка отправки фото:", error.message);
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
}
