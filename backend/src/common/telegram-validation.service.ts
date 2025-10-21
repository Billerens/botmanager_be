import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class TelegramValidationService {
  private readonly logger = new Logger(TelegramValidationService.name);
  private readonly botToken: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>("app.telegramBotToken");
    if (!this.botToken) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN не установлен в переменных окружения"
      );
    }
  }

  async sendVerificationCode(
    telegramId: string,
    code: string
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error(
        "Не удалось отправить код: TELEGRAM_BOT_TOKEN не установлен"
      );
      return false;
    }

    try {
      const message = `🔐 Код подтверждения для BotManager\n\nВаш код: <b>${code}</b>\n\nКод действителен 15 минут.`;

      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: telegramId,
          text: message,
          parse_mode: "HTML",
        }
      );

      if (response.data.ok) {
        this.logger.log(
          `Код верификации отправлен в Telegram для ID: ${telegramId}`
        );
        return true;
      } else {
        this.logger.error(
          `Ошибка отправки в Telegram: ${response.data.description}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки кода верификации в Telegram:`,
        error.message
      );
      return false;
    }
  }

  async sendWelcomeMessage(
    telegramId: string,
    firstName?: string
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error(
        "Не удалось отправить приветствие: TELEGRAM_BOT_TOKEN не установлен"
      );
      return false;
    }

    try {
      const greeting = firstName ? `, ${firstName}` : "";
      const message = `🎉 Добро пожаловать в BotManager${greeting}!\n\nВаш аккаунт успешно подтвержден. Теперь вы можете создавать и управлять своими Telegram ботами.`;

      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: telegramId,
          text: message,
          parse_mode: "HTML",
        }
      );

      if (response.data.ok) {
        this.logger.log(
          `Приветственное сообщение отправлено в Telegram для ID: ${telegramId}`
        );
        return true;
      } else {
        this.logger.error(
          `Ошибка отправки приветствия в Telegram: ${response.data.description}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки приветственного сообщения в Telegram:`,
        error.message
      );
      return false;
    }
  }
}
