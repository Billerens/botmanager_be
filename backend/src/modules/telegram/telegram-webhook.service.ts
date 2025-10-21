import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { User } from "../../database/entities/user.entity";

export interface TelegramUpdate {
  update_id: number;
  message?: {
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
      first_name: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

@Injectable()
export class TelegramWebhookService {
  private readonly logger = new Logger(TelegramWebhookService.name);
  private readonly botToken: string;
  private readonly telegramApiUrl: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {
    this.botToken = this.configService.get<string>("app.telegramBotToken");
    this.telegramApiUrl = this.configService.get<string>(
      "TELEGRAM_BOT_API_URL",
      "https://api.telegram.org/bot"
    );

    if (!this.botToken) {
      this.logger.error(
        "TELEGRAM_BOT_TOKEN не установлен. Функционал Telegram webhook будет недоступен."
      );
    }
  }

  private getBotApiUrl(): string {
    return `${this.telegramApiUrl}${this.botToken}`;
  }

  async handleWebhook(update: TelegramUpdate): Promise<void> {
    try {
      this.logger.log(`Получен webhook: ${JSON.stringify(update)}`);

      if (update.message?.text) {
        await this.handleMessage(update.message);
      }
    } catch (error) {
      this.logger.error(
        `Ошибка обработки webhook: ${error.message}`,
        error.stack
      );
    }
  }

  private async handleMessage(
    message: TelegramUpdate["message"]
  ): Promise<void> {
    if (!message) return;

    const { text, from, chat } = message;
    const telegramId = from.id.toString();

    this.logger.log(`Обработка сообщения от ${telegramId}: ${text}`);

    // Обрабатываем команду /start
    if (text === "/start") {
      await this.handleStartCommand(telegramId, from, chat);
    }
  }

  private async handleStartCommand(
    telegramId: string,
    from: TelegramUpdate["message"]["from"],
    chat: TelegramUpdate["message"]["chat"]
  ): Promise<void> {
    try {
      // Проверяем, существует ли пользователь в базе данных
      const existingUser = await this.userRepository.findOne({
        where: { telegramId },
      });

      if (existingUser) {
        // Пользователь уже зарегистрирован
        await this.sendWelcomeBackMessage(chat.id, from.first_name);
      } else {
        // Новый пользователь - показываем инструкции по регистрации
        await this.sendRegistrationInstructions(
          chat.id,
          from.first_name,
          telegramId
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка обработки команды /start для ${telegramId}: ${error.message}`,
        error.stack
      );
    }
  }

  private async sendWelcomeBackMessage(
    chatId: number,
    firstName: string
  ): Promise<void> {
    const message = `Привет, ${firstName}! 👋\n\nДобро пожаловать обратно в BotManager! Ваш аккаунт уже зарегистрирован и готов к использованию.\n\nДля управления ботами перейдите в веб-интерфейс: ${this.configService.get("app.frontendUrl")}`;

    await this.sendMessage(chatId, message);
  }

  private async sendRegistrationInstructions(
    chatId: number,
    firstName: string,
    telegramId: string
  ): Promise<void> {
    const message = `Привет, ${firstName}! 👋\n\nДобро пожаловать в BotManager! 🚀\n\nДля начала работы с нашим сервисом вам необходимо зарегистрироваться.\n\n📋 Ваш Telegram ID: \`${telegramId}\`\n\n🔗 Перейдите по ссылке для регистрации:\n${this.configService.get("app.frontendUrl")}/register\n\n📝 Инструкция по регистрации:\n1. Откройте ссылку выше\n2. Введите ваш Telegram ID: \`${telegramId}\`\n3. Заполните остальные поля\n4. Подтвердите регистрацию кодом, который мы отправим\n\nПосле регистрации вы сможете создавать и управлять Telegram ботами! 🤖`;

    await this.sendMessage(chatId, message, { parse_mode: "Markdown" });
  }

  private async sendMessage(
    chatId: number,
    text: string,
    options?: { parse_mode?: "HTML" | "Markdown" | "MarkdownV2" }
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn(
        `Попытка отправить сообщение без TELEGRAM_BOT_TOKEN для chatId: ${chatId}`
      );
      return false;
    }

    try {
      const url = `${this.getBotApiUrl()}/sendMessage`;
      this.logger.debug(
        `Отправка сообщения в Telegram: ${chatId}, текст: ${text.substring(0, 50)}...`
      );

      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        ...options,
      });

      if (response.data.ok) {
        this.logger.log(
          `Сообщение успешно отправлено в Telegram для chatId: ${chatId}`
        );
        return true;
      } else {
        this.logger.error(
          `Ошибка отправки сообщения в Telegram для chatId ${chatId}: ${response.data.description}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Исключение при отправке сообщения в Telegram для chatId ${chatId}: ${error.message}`,
        error.stack
      );
      return false;
    }
  }

  // Метод для установки webhook (вызывается при запуске приложения)
  async setWebhook(): Promise<void> {
    if (!this.botToken) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN не установлен, webhook не будет установлен"
      );
      return;
    }

    try {
      const webhookUrl = `${this.configService.get("app.webhookBaseUrl")}/api/telegram/webhook`;
      const url = `${this.getBotApiUrl()}/setWebhook`;

      this.logger.log(`Установка webhook: ${webhookUrl}`);

      const response = await axios.post(url, {
        url: webhookUrl,
        allowed_updates: ["message"],
      });

      if (response.data.ok) {
        this.logger.log("Webhook успешно установлен");
      } else {
        this.logger.error(
          `Ошибка установки webhook: ${response.data.description}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Исключение при установке webhook: ${error.message}`,
        error.stack
      );
    }
  }
}
