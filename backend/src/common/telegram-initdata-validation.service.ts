import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as crypto from "crypto";
import { URLSearchParams } from "url";

export interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ValidatedInitData {
  user?: TelegramInitDataUser;
  receiver?: TelegramInitDataUser;
  chat?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    photo_url?: string;
  };
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

@Injectable()
export class TelegramInitDataValidationService {
  private readonly logger = new Logger(TelegramInitDataValidationService.name);

  /**
   * Валидирует initData от Telegram WebApp
   * @param initData - строка initData от Telegram WebApp
   * @param botToken - токен бота для валидации
   * @returns Валидированные данные или null, если валидация не прошла
   */
  validateInitData(
    initData: string,
    botToken: string
  ): ValidatedInitData | null {
    if (!initData || !botToken) {
      this.logger.warn("initData или botToken не предоставлены");
      return null;
    }

    try {
      // Парсим initData
      const params = new URLSearchParams(initData);
      const hash = params.get("hash");

      if (!hash) {
        this.logger.warn("hash не найден в initData");
        return null;
      }

      // Удаляем hash из параметров для проверки
      params.delete("hash");

      // Сортируем параметры по ключу
      const sortedParams = Array.from(params.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );

      // Создаем строку для проверки
      const dataCheckString = sortedParams
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

      // Вычисляем секретный ключ
      const secretKey = crypto
        .createHmac("sha256", "WebAppData")
        .update(botToken)
        .digest();

      // Вычисляем hash
      const calculatedHash = crypto
        .createHmac("sha256", secretKey)
        .update(dataCheckString)
        .digest("hex");

      // Сравниваем хеши
      if (calculatedHash !== hash) {
        this.logger.warn("Неверный hash в initData");
        return null;
      }

      // Проверяем, что данные не устарели (не старше 24 часов)
      const authDate = params.get("auth_date");
      if (authDate) {
        const authDateTimestamp = parseInt(authDate, 10);
        const now = Math.floor(Date.now() / 1000);
        const maxAge = 24 * 60 * 60; // 24 часа

        if (now - authDateTimestamp > maxAge) {
          this.logger.warn("initData устарел");
          return null;
        }
      }

      // Парсим данные пользователя
      const userStr = params.get("user");
      let user: TelegramInitDataUser | undefined;
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch (e) {
          this.logger.warn("Не удалось распарсить user из initData");
        }
      }

      // Парсим данные получателя
      const receiverStr = params.get("receiver");
      let receiver: TelegramInitDataUser | undefined;
      if (receiverStr) {
        try {
          receiver = JSON.parse(receiverStr);
        } catch (e) {
          // Игнорируем ошибку
        }
      }

      // Парсим данные чата
      const chatStr = params.get("chat");
      let chat: ValidatedInitData["chat"] | undefined;
      if (chatStr) {
        try {
          chat = JSON.parse(chatStr);
        } catch (e) {
          // Игнорируем ошибку
        }
      }

      return {
        user,
        receiver,
        chat,
        chat_type: params.get("chat_type") || undefined,
        chat_instance: params.get("chat_instance") || undefined,
        start_param: params.get("start_param") || undefined,
        can_send_after: params.get("can_send_after")
          ? parseInt(params.get("can_send_after")!, 10)
          : undefined,
        auth_date: authDate ? parseInt(authDate, 10) : 0,
        hash,
      };
    } catch (error) {
      this.logger.error("Ошибка валидации initData:", error);
      return null;
    }
  }

  /**
   * Валидирует initData и выбрасывает исключение, если валидация не прошла
   * @param initData - строка initData от Telegram WebApp
   * @param botToken - токен бота для валидации
   * @returns Валидированные данные
   * @throws UnauthorizedException если валидация не прошла
   */
  validateInitDataOrThrow(
    initData: string,
    botToken: string
  ): ValidatedInitData {
    const validated = this.validateInitData(initData, botToken);
    if (!validated) {
      throw new UnauthorizedException("Неверный или устаревший initData");
    }
    return validated;
  }
}
