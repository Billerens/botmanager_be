import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { TelegramService, TelegramUpdate } from "./telegram.service";
import { BotsService } from "../bots/bots.service";
import { FlowExecutionService } from "../bots/flow-execution.service";
import { MessagesService } from "../messages/messages.service";
import { LeadsService } from "../leads/leads.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { NotificationService } from "../websocket/services/notification.service";
import { NotificationType } from "../websocket/interfaces/notification.interface";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import {
  MessageType,
  MessageContentType,
  Message,
} from "../../database/entities/message.entity";
import { Bot } from "../../database/entities/bot.entity";
import {
  TelegramWebhookResponseDto,
  TelegramBotInfoResponseDto,
  TelegramMessageResponseDto,
  TelegramCallbackResponseDto,
} from "./dto/telegram-response.dto";

@ApiTags("Telegram Webhook")
@Controller("telegram")
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  // Кэш обработанных update_id для дедупликации (TTL: 5 минут)
  private readonly processedUpdates = new Map<
    string,
    { timestamp: number; processing: boolean }
  >();
  private readonly UPDATE_CACHE_TTL = 5 * 60 * 1000; // 5 минут
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 минута

  constructor(
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly flowExecutionService: FlowExecutionService,
    private readonly messagesService: MessagesService,
    private readonly leadsService: LeadsService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>
  ) {
    // Запускаем периодическую очистку кэша обработанных обновлений
    this.startCacheCleanup();
  }

  /**
   * Запускает периодическую очистку устаревших записей в кэше
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, value] of this.processedUpdates.entries()) {
        if (now - value.timestamp > this.UPDATE_CACHE_TTL) {
          this.processedUpdates.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(
          `Очищено ${cleanedCount} устаревших записей из кэша обновлений`
        );
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Проверяет, было ли обновление уже обработано
   * Возвращает true, если это дубликат
   */
  private isDuplicateUpdate(
    botId: string,
    updateId: number
  ): { isDuplicate: boolean; isProcessing: boolean } {
    const key = `${botId}:${updateId}`;
    const cached = this.processedUpdates.get(key);

    if (!cached) {
      return { isDuplicate: false, isProcessing: false };
    }

    // Проверяем, не устарела ли запись
    if (Date.now() - cached.timestamp > this.UPDATE_CACHE_TTL) {
      this.processedUpdates.delete(key);
      return { isDuplicate: false, isProcessing: false };
    }

    return { isDuplicate: true, isProcessing: cached.processing };
  }

  /**
   * Отмечает обновление как обрабатываемое
   */
  private markUpdateProcessing(botId: string, updateId: number): void {
    const key = `${botId}:${updateId}`;
    this.processedUpdates.set(key, { timestamp: Date.now(), processing: true });
  }

  /**
   * Отмечает обновление как обработанное
   */
  private markUpdateProcessed(botId: string, updateId: number): void {
    const key = `${botId}:${updateId}`;
    this.processedUpdates.set(key, {
      timestamp: Date.now(),
      processing: false,
    });
  }

  @Post("webhook/:botId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для получения обновлений от Telegram" })
  @ApiResponse({
    status: 200,
    description: "Обновление обработано",
    schema: {
      $ref: getSchemaPath(TelegramWebhookResponseDto),
    },
  })
  async handleWebhook(
    @Param("botId") botId: string,
    @Body() update: TelegramUpdate,
    @Headers() headers: Record<string, string>
  ) {
    // Проверяем дублирование update_id
    const { isDuplicate, isProcessing } = this.isDuplicateUpdate(
      botId,
      update.update_id
    );

    if (isDuplicate) {
      if (isProcessing) {
        this.logger.warn(
          `Обновление ${update.update_id} для бота ${botId} уже обрабатывается (дубликат webhook)`
        );
      } else {
        this.logger.debug(
          `Обновление ${update.update_id} для бота ${botId} уже было обработано (дубликат webhook)`
        );
      }
      // Возвращаем OK, чтобы Telegram не повторял запрос
      return { ok: true, duplicate: true };
    }

    // Сразу отмечаем как обрабатываемое, чтобы предотвратить параллельную обработку
    this.markUpdateProcessing(botId, update.update_id);

    try {
      this.logger.log(
        `Получено обновление ${update.update_id} для бота ${botId}: ${JSON.stringify({ from: update.message?.from })}`
      );

      // Находим бота
      const bot = await this.botsService.findById(botId);
      if (!bot) {
        this.logger.warn(`Бот ${botId} не найден`);
        this.markUpdateProcessed(botId, update.update_id);
        return { ok: true };
      }

      // Проверяем статус бота
      if (bot.status !== "active") {
        this.logger.warn(
          `Бот ${botId} неактивен (статус: ${bot.status}), игнорируем обновление`
        );
        this.markUpdateProcessed(botId, update.update_id);
        return { ok: true };
      }

      // Обрабатываем обновление
      await this.processUpdate(bot, update);

      // Отмечаем как успешно обработанное
      this.markUpdateProcessed(botId, update.update_id);

      return { ok: true };
    } catch (error) {
      this.logger.error(`Ошибка обработки webhook для бота ${botId}:`, error);
      // Отмечаем как обработанное даже при ошибке, чтобы избежать повторной обработки
      this.markUpdateProcessed(botId, update.update_id);
      return { ok: false, error: error.message };
    }
  }

  private async processUpdate(bot: any, update: TelegramUpdate): Promise<void> {
    try {
      // Обрабатываем сообщения
      if (update.message) {
        await this.processMessage(bot, update.message);
      }

      // Обрабатываем callback queries
      if (update.callback_query) {
        await this.processCallbackQuery(bot, update.callback_query);
      }

      // Обрабатываем edited messages
      if (update.edited_message) {
        await this.processEditedMessage(bot, update.edited_message);
      }
    } catch (error) {
      this.logger.error("Ошибка обработки обновления:", error);

      // Логируем ошибку (userId владельца бота) - неблокирующий вызов
      this.activityLogService
        .create({
          type: ActivityType.BOT_ERROR,
          level: ActivityLevel.ERROR,
          message: `Ошибка обработки обновления: ${error.message}`,
          userId: bot.ownerId,
          botId: bot.id,
          metadata: { update, error: error.message },
        })
        .catch((logError) => {
          this.logger.error("Ошибка логирования активности:", logError);
        });
    }
  }

  private async processMessage(bot: any, message: any): Promise<void> {
    try {
      const telegramChatId = message.chat.id.toString();

      // Сохраняем входящее сообщение
      const savedMessage = await this.messagesService.create({
        botId: bot.id,
        telegramMessageId: message.message_id,
        telegramChatId: telegramChatId,
        telegramUserId: message.from.id.toString(),
        type: MessageType.INCOMING,
        contentType: this.getMessageContentType(message),
        text: message.text || message.caption,
        media: this.extractMedia(message),
        keyboard: this.extractKeyboard(message),
        metadata: {
          firstName: message.from.first_name,
          lastName: message.from.last_name,
          username: message.from.username,
          languageCode: message.from.language_code,
          isBot: message.from.is_bot,
          replyToMessageId: message.reply_to_message?.message_id,
          chatType: message.chat.type,
          chatTitle: message.chat.title,
          chatUsername: message.chat.username,
        },
      });

      // Проверяем, является ли это новым диалогом (новым пользователем)
      // Используем репозиторий для оптимизации запроса
      // Проверяем ПОСЛЕ создания сообщения, чтобы уменьшить вероятность race condition
      const dialogMessageCount = await this.messageRepository.count({
        where: {
          botId: bot.id,
          telegramChatId: telegramChatId,
        },
      });

      const isNewUser = dialogMessageCount === 1; // Если это первое сообщение для диалога

      // Обновляем статистику бота
      // Используем репозиторий для атомарного обновления
      await Promise.all([
        // Обновляем totalMessages
        this.botRepository.increment({ id: bot.id }, "totalMessages", 1),
        // Если это новый пользователь - увеличиваем totalUsers
        isNewUser
          ? this.botRepository.increment({ id: bot.id }, "totalUsers", 1)
          : Promise.resolve(),
      ]);

      // Логируем активность (userId владельца бота) - неблокирующий вызов
      this.activityLogService
        .create({
          type: ActivityType.MESSAGE_RECEIVED,
          level: ActivityLevel.INFO,
          message: `Получено сообщение от пользователя ${message.from.first_name}`,
          userId: bot.ownerId,
          botId: bot.id,
          metadata: {
            messageId: savedMessage.id,
            telegramUserId: message.from.id,
            chatId: message.chat.id,
            isNewUser,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования активности:", error);
        });

      // Отправляем уведомление о получении сообщения владельцу бота
      // Отправляем полный объект сообщения для корректной обработки на фронтенде
      this.notificationService
        .sendToUser(bot.ownerId, NotificationType.MESSAGE_RECEIVED, {
          botId: bot.id,
          message: savedMessage, // Отправляем полный объект сообщения
          isNewUser,
        })
        .catch((error) => {
          this.logger.error(
            "Ошибка отправки уведомления о получении сообщения:",
            error
          );
        });

      // Обрабатываем сообщение через flow
      await this.flowExecutionService.processMessage(bot, message);
    } catch (error) {
      this.logger.error("Ошибка обработки сообщения:", error);
      throw error;
    }
  }

  private async processCallbackQuery(
    bot: any,
    callbackQuery: any
  ): Promise<void> {
    try {
      // Создаем объект сообщения для обработки через flow
      const message = {
        message_id: callbackQuery.message.message_id,
        from: callbackQuery.from,
        chat: callbackQuery.message.chat,
        text: callbackQuery.data,
        date: callbackQuery.message.date,
        is_callback: true,
        callback_query: callbackQuery,
      };

      // Обрабатываем callback query как обычное сообщение через flow
      await this.flowExecutionService.processMessage(bot, message);

      // Отвечаем на callback query
      const decryptedToken = this.botsService.decryptToken(bot.token);
      await this.telegramService.answerCallbackQuery(
        decryptedToken,
        callbackQuery.id,
        { text: "Обработано" }
      );
    } catch (error) {
      this.logger.error("Ошибка обработки callback query:", error);
      throw error;
    }
  }

  private async processEditedMessage(bot: any, message: any): Promise<void> {
    try {
      // Обрабатываем отредактированное сообщение
      this.logger.log("Обработка отредактированного сообщения:", message);

      // Логируем активность (userId владельца бота) - неблокирующий вызов
      this.activityLogService
        .create({
          type: ActivityType.MESSAGE_RECEIVED,
          level: ActivityLevel.INFO,
          message: `Получено отредактированное сообщение от пользователя ${message.from.first_name}`,
          userId: bot.ownerId,
          botId: bot.id,
          metadata: {
            messageId: message.message_id,
            telegramUserId: message.from.id,
            chatId: message.chat.id,
          },
        })
        .catch((error) => {
          this.logger.error("Ошибка логирования активности:", error);
        });
    } catch (error) {
      this.logger.error(
        "Ошибка обработки отредактированного сообщения:",
        error
      );
      throw error;
    }
  }

  private getMessageContentType(message: any): MessageContentType {
    if (message.text) return MessageContentType.TEXT;
    if (message.photo) return MessageContentType.PHOTO;
    if (message.video) return MessageContentType.VIDEO;
    if (message.audio) return MessageContentType.AUDIO;
    if (message.document) return MessageContentType.DOCUMENT;
    if (message.sticker) return MessageContentType.STICKER;
    if (message.voice) return MessageContentType.VOICE;
    if (message.location) return MessageContentType.LOCATION;
    if (message.contact) return MessageContentType.CONTACT;
    return MessageContentType.TEXT;
  }

  private extractMedia(message: any): any {
    if (message.photo) {
      const photo = message.photo[message.photo.length - 1]; // Берем самое большое фото
      return {
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size,
      };
    }

    if (message.video) {
      return {
        fileId: message.video.file_id,
        fileUniqueId: message.video.file_unique_id,
        fileName: message.video.file_name,
        fileSize: message.video.file_size,
        mimeType: message.video.mime_type,
        width: message.video.width,
        height: message.video.height,
        duration: message.video.duration,
      };
    }

    if (message.audio) {
      return {
        fileId: message.audio.file_id,
        fileUniqueId: message.audio.file_unique_id,
        fileName: message.audio.file_name,
        fileSize: message.audio.file_size,
        mimeType: message.audio.mime_type,
        duration: message.audio.duration,
      };
    }

    if (message.document) {
      return {
        fileId: message.document.file_id,
        fileUniqueId: message.document.file_unique_id,
        fileName: message.document.file_name,
        fileSize: message.document.file_size,
        mimeType: message.document.mime_type,
      };
    }

    if (message.voice) {
      return {
        fileId: message.voice.file_id,
        fileUniqueId: message.voice.file_unique_id,
        fileSize: message.voice.file_size,
        mimeType: message.voice.mime_type,
        duration: message.voice.duration,
      };
    }

    return null;
  }

  private extractKeyboard(message: any): any {
    if (message.reply_markup) {
      if (message.reply_markup.inline_keyboard) {
        return {
          type: "inline",
          buttons: message.reply_markup.inline_keyboard.map((row) =>
            row.map((button) => ({
              text: button.text,
              callbackData: button.callback_data,
              url: button.url,
              webApp: button.web_app,
            }))
          ),
        };
      }

      if (message.reply_markup.keyboard) {
        return {
          type: "reply",
          buttons: message.reply_markup.keyboard.map((row) =>
            row.map((button) => ({
              text: button.text,
              callbackData: button.callback_data,
              url: button.url,
              webApp: button.web_app,
            }))
          ),
        };
      }
    }

    return null;
  }
}
