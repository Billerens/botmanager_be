import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { SessionStorageService } from "../session-storage.service";

@Processor("group-actions")
export class GroupActionsProcessor {
  private readonly logger = new Logger(GroupActionsProcessor.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly sessionStorageService: SessionStorageService
  ) {}

  /**
   * Обработка broadcast сообщений для группы
   */
  @Process("broadcast")
  async handleBroadcast(job: Job): Promise<void> {
    const {
      groupId,
      botId,
      botToken,
      message,
      buttons,
      excludeUserId,
      participantIds,
    } = job.data;

    this.logger.log(
      `Обработка broadcast для группы ${groupId}, участников: ${participantIds.length}`
    );

    try {
      const decryptedToken = this.botsService.decryptToken(botToken);

      // Обрабатываем порциями по 100 участников
      const batchSize = 100;
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < participantIds.length; i += batchSize) {
        const batch = participantIds.slice(i, i + batchSize);

        // Отправляем сообщения параллельно в пределах batch
        const promises = batch.map(async (userId: string) => {
          // Пропускаем если это исключенный пользователь
          if (excludeUserId && userId === excludeUserId) {
            return;
          }

          try {
            // Получаем chatId пользователя
            const session = await this.sessionStorageService.getSession(
              botId,
              userId
            );

            if (!session) {
              this.logger.warn(
                `Сессия пользователя ${userId} не найдена, пропускаем`
              );
              return;
            }

            // Формируем опции сообщения
            const options: any = {};

            if (buttons && buttons.length > 0) {
              options.reply_markup = {
                inline_keyboard: [
                  buttons.map((btn: any) => ({
                    text: btn.text,
                    callback_data: btn.callbackData,
                    url: btn.url,
                  })),
                ],
              };
            }

            // Отправляем сообщение
            await this.telegramService.sendMessage(
              decryptedToken,
              session.chatId,
              message,
              options
            );

            processed++;
          } catch (error) {
            this.logger.error(
              `Ошибка отправки сообщения пользователю ${userId}:`,
              error
            );
            failed++;
          }
        });

        // Ждем завершения batch
        await Promise.all(promises);

        // Обновляем прогресс
        job.progress(Math.floor((processed / participantIds.length) * 100));

        this.logger.log(
          `Обработано ${processed}/${participantIds.length} участников`
        );
      }

      this.logger.log(
        `Broadcast завершен. Успешно: ${processed}, Ошибок: ${failed}`
      );
    } catch (error) {
      this.logger.error(`Ошибка в broadcast processor:`, error);
      throw error;
    }
  }

  /**
   * Обработка сбора данных от участников (опционально)
   */
  @Process("collect")
  async handleCollect(job: Job): Promise<void> {
    const { groupId, variableName, timeout } = job.data;

    this.logger.log(
      `Обработка collect для группы ${groupId}, переменная: ${variableName}`
    );

    // Логика сбора данных уже реализована в handler
    // Здесь можно добавить дополнительную асинхронную обработку при необходимости
  }

  /**
   * Обработка уведомлений о событиях группы
   */
  @Process("notify")
  async handleNotify(job: Job): Promise<void> {
    const { groupId, eventType, data } = job.data;

    this.logger.log(
      `Обработка уведомления для группы ${groupId}, событие: ${eventType}`
    );

    // Здесь можно добавить логику для различных типов уведомлений
    // Например: участник присоединился, покинул группу, изменение состояния и т.д.
  }
}
