import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

export interface TelegramUserInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

@Injectable()
export class TelegramUserInfoService {
  private readonly logger = new Logger(TelegramUserInfoService.name);
  private readonly botToken: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>("app.telegramBotToken");
    if (!this.botToken) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN не установлен в переменных окружения"
      );
    }
  }

  async getUserInfo(telegramId: string): Promise<TelegramUserInfo | null> {
    if (!this.botToken) {
      this.logger.error(
        "Не удалось получить информацию о пользователе: TELEGRAM_BOT_TOKEN не установлен"
      );
      return null;
    }

    try {
      // Используем метод getChat для получения информации о пользователе
      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/getChat`,
        {
          chat_id: telegramId,
        }
      );

      if (response.data.ok) {
        const chat = response.data.result;

        // Проверяем, что это личный чат (не бот и не группа)
        if (chat.type === "private" && !chat.is_bot) {
          return {
            id: chat.id,
            is_bot: false,
            first_name: chat.first_name,
            last_name: chat.last_name,
            username: chat.username,
            language_code: chat.language_code,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Ошибка получения информации о пользователе Telegram ID ${telegramId}:`,
        error.message
      );

      // Если пользователь не начал диалог с ботом, возвращаем null
      if (error.response?.status === 400) {
        return null;
      }

      throw new BadRequestException(
        "Не удалось получить информацию о пользователе Telegram"
      );
    }
  }

  async validateTelegramId(telegramId: string): Promise<boolean> {
    try {
      const userInfo = await this.getUserInfo(telegramId);
      return userInfo !== null;
    } catch (error) {
      return false;
    }
  }
}
