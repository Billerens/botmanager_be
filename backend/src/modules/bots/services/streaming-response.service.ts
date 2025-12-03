import { Injectable, Logger } from "@nestjs/common";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { MessagesService } from "../../messages/messages.service";
import {
  MessageType,
  MessageContentType,
} from "../../../database/entities/message.entity";

/**
 * Опции для streaming ответа
 */
export interface StreamingOptions {
  /** Минимальный интервал между редактированиями (мс) */
  throttleMs?: number;
  /** Показывать курсор "▌" во время генерации */
  showCursor?: boolean;
  /** Префикс сообщения (например, "🤖 [Model Name]\n\n") */
  messagePrefix?: string;
  /** Начальное сообщение пока идёт генерация */
  initialMessage?: string;
  /** Callback для обновления typing статуса */
  onTypingNeeded?: () => Promise<void>;
}

/**
 * Результат streaming генерации
 */
export interface StreamingResult {
  /** Полный текст ответа */
  fullResponse: string;
  /** ID сообщения в Telegram */
  telegramMessageId: number;
  /** Было ли использовано редактирование (streaming) или обычная отправка */
  wasStreamed: boolean;
  /** Количество редактирований сообщения */
  editCount: number;
}

/**
 * Сервис для отправки AI ответов с эффектом streaming
 *
 * Использует throttled редактирование сообщений для создания
 * эффекта печатания как в ChatGPT. При ошибках streaming
 * автоматически переключается на обычную отправку.
 */
@Injectable()
export class StreamingResponseService {
  private readonly logger = new Logger(StreamingResponseService.name);

  // Дефолтные значения
  private readonly DEFAULT_THROTTLE_MS = 800; // 800мс между редактированиями
  private readonly CURSOR = "▌";
  private readonly TYPING_INTERVAL_MS = 4500; // Интервал для обновления "typing" статуса

  constructor(
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly messagesService: MessagesService
  ) {}

  /**
   * Отправляет streaming ответ с throttled редактированием
   *
   * @param bot - Объект бота
   * @param chatId - ID чата Telegram
   * @param streamGenerator - AsyncGenerator, генерирующий чанки текста
   * @param options - Опции streaming
   * @returns Результат streaming
   */
  async sendStreamingResponse(
    bot: any,
    chatId: string,
    streamGenerator: AsyncGenerator<string, void, unknown>,
    options: StreamingOptions = {}
  ): Promise<StreamingResult> {
    const {
      throttleMs = this.DEFAULT_THROTTLE_MS,
      showCursor = true,
      messagePrefix = "",
      initialMessage = "⏳ Генерирую ответ...",
      onTypingNeeded,
    } = options;

    const decryptedToken = this.botsService.decryptToken(bot.token);

    let fullResponse = "";
    let telegramMessageId: number | null = null;
    let lastEditTime = 0;
    let editCount = 0;
    let pendingUpdate = "";
    let typingInterval: NodeJS.Timeout | null = null;

    try {
      // 1. Отправляем начальное сообщение
      const initialResponse = await this.telegramService.sendMessage(
        decryptedToken,
        chatId,
        messagePrefix + initialMessage + (showCursor ? this.CURSOR : "")
      );

      if (!initialResponse) {
        throw new Error("Не удалось отправить начальное сообщение");
      }

      telegramMessageId = initialResponse.message_id;
      this.logger.debug(
        `Streaming: Начальное сообщение отправлено, ID: ${telegramMessageId}`
      );

      // 2. Запускаем интервал для "typing" статуса
      if (onTypingNeeded) {
        typingInterval = setInterval(async () => {
          try {
            await onTypingNeeded();
          } catch (error) {
            this.logger.debug(`Ошибка отправки typing: ${error.message}`);
          }
        }, this.TYPING_INTERVAL_MS);
      }

      // 3. Обрабатываем streaming чанки
      for await (const chunk of streamGenerator) {
        fullResponse += chunk;
        pendingUpdate = fullResponse;

        const now = Date.now();
        const timeSinceLastEdit = now - lastEditTime;

        // Throttle: редактируем только если прошло достаточно времени
        if (timeSinceLastEdit >= throttleMs) {
          await this.editStreamingMessage(
            decryptedToken,
            chatId,
            telegramMessageId,
            messagePrefix + pendingUpdate + (showCursor ? this.CURSOR : "")
          );
          lastEditTime = now;
          editCount++;
          pendingUpdate = "";
        }
      }

      // 4. Финальное редактирование (убираем курсор, добавляем оставшийся текст)
      if (telegramMessageId) {
        const finalMessage = messagePrefix + fullResponse;
        await this.editStreamingMessage(
          decryptedToken,
          chatId,
          telegramMessageId,
          finalMessage
        );
        editCount++;

        this.logger.log(
          `Streaming: Завершено, ${fullResponse.length} символов, ${editCount} редактирований`
        );
      }

      // 5. Сохраняем финальное сообщение в БД
      if (telegramMessageId) {
        await this.saveOutgoingMessage(
          bot,
          chatId,
          messagePrefix + fullResponse,
          telegramMessageId
        );
      }

      return {
        fullResponse,
        telegramMessageId: telegramMessageId!,
        wasStreamed: true,
        editCount,
      };
    } catch (error) {
      this.logger.error(`Streaming error: ${error.message}`);

      // Если есть частичный ответ и сообщение было создано, пытаемся завершить
      if (telegramMessageId && fullResponse) {
        try {
          const finalMessage = messagePrefix + fullResponse;
          await this.editStreamingMessage(
            decryptedToken,
            chatId,
            telegramMessageId,
            finalMessage
          );

          await this.saveOutgoingMessage(
            bot,
            chatId,
            finalMessage,
            telegramMessageId
          );

          return {
            fullResponse,
            telegramMessageId,
            wasStreamed: true,
            editCount,
          };
        } catch (finalError) {
          this.logger.error(
            `Ошибка финализации streaming: ${finalError.message}`
          );
        }
      }

      throw error;
    } finally {
      // Очищаем интервал typing
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    }
  }

  /**
   * Отправляет ответ с fallback на обычную отправку при ошибке streaming
   */
  async sendWithStreamingFallback(
    bot: any,
    chatId: string,
    streamGenerator: AsyncGenerator<string, void, unknown>,
    fallbackResponse: string,
    options: StreamingOptions = {}
  ): Promise<StreamingResult> {
    try {
      return await this.sendStreamingResponse(
        bot,
        chatId,
        streamGenerator,
        options
      );
    } catch (error) {
      this.logger.warn(
        `Streaming не удался, используем fallback: ${error.message}`
      );

      // Fallback: отправляем обычное сообщение
      const decryptedToken = this.botsService.decryptToken(bot.token);
      const finalMessage = (options.messagePrefix || "") + fallbackResponse;

      const response = await this.telegramService.sendMessage(
        decryptedToken,
        chatId,
        finalMessage
      );

      if (response) {
        await this.saveOutgoingMessage(
          bot,
          chatId,
          finalMessage,
          response.message_id
        );

        return {
          fullResponse: fallbackResponse,
          telegramMessageId: response.message_id,
          wasStreamed: false,
          editCount: 0,
        };
      }

      throw new Error("Не удалось отправить fallback сообщение");
    }
  }

  /**
   * Запускает "typing" индикатор с автоматическим обновлением
   * Возвращает функцию для остановки
   */
  startTypingIndicator(bot: any, chatId: string): () => void {
    const decryptedToken = this.botsService.decryptToken(bot.token);
    let isRunning = true;

    const sendTyping = async () => {
      if (!isRunning) return;
      try {
        await this.telegramService.sendChatAction(
          decryptedToken,
          chatId,
          "typing"
        );
      } catch (error) {
        this.logger.debug(`Typing indicator error: ${error.message}`);
      }
    };

    // Отправляем сразу
    sendTyping();

    // И каждые 4.5 секунды (статус сбрасывается через 5 сек)
    const interval = setInterval(sendTyping, this.TYPING_INTERVAL_MS);

    // Возвращаем функцию остановки
    return () => {
      isRunning = false;
      clearInterval(interval);
    };
  }

  /**
   * Редактирует сообщение с обработкой ошибок rate limiting
   */
  private async editStreamingMessage(
    token: string,
    chatId: string,
    messageId: number,
    text: string
  ): Promise<boolean> {
    try {
      // Telegram не позволяет отправлять пустые сообщения
      const safeText = text.trim() || "...";

      const result = await this.telegramService.editMessageText(
        token,
        chatId,
        messageId,
        safeText
      );

      return result;
    } catch (error: any) {
      // Игнорируем ошибку "message is not modified"
      if (error.message?.includes("message is not modified")) {
        return true;
      }

      // Rate limiting - логируем, но не прерываем
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.parameters?.retry_after || 1;
        this.logger.warn(`Rate limited, retry after ${retryAfter}s`);
        // Можно подождать, но для UX лучше пропустить это обновление
        return false;
      }

      throw error;
    }
  }

  /**
   * Сохраняет исходящее сообщение в БД
   */
  private async saveOutgoingMessage(
    bot: any,
    chatId: string,
    text: string,
    telegramMessageId: number
  ): Promise<void> {
    try {
      await this.messagesService.create({
        botId: bot.id,
        telegramMessageId,
        telegramChatId: chatId,
        telegramUserId: bot.id,
        type: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        text,
        metadata: {
          firstName: bot.name || "Bot",
          lastName: "",
          username: bot.username,
          isBot: true,
          isStreamed: true,
        },
        isProcessed: true,
        processedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Ошибка сохранения сообщения: ${error.message}`);
    }
  }
}
