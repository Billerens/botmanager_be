import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { BotManagerWebSocketGateway } from "../websocket.gateway";
import { RedisService } from "./redis.service";
import {
  Notification,
  NotificationType,
  SendNotificationDto,
} from "../interfaces/notification.interface";
import {
  NotificationItemDto,
  NotificationListDto,
  NotificationSummaryDto,
} from "../dto/notification.dto";
import { v4 as uuidv4 } from "uuid";

/**
 * Сервис для отправки уведомлений через WebSocket
 * Поддерживает отправку через Redis pub/sub для масштабируемости
 */
@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly REDIS_CHANNEL = "websocket:notifications";
  private readonly STREAM_PREFIX = "notifications:user:";
  private readonly MAX_PENDING_NOTIFICATIONS = 1000; // Максимум уведомлений на пользователя
  private readonly NOTIFICATION_TTL_DAYS = 7; // Срок хранения уведомлений в днях
  private readonly READ_RETENTION_DAYS = 3; // Срок хранения прочитанных уведомлений в днях
  private redisSubscriptionSetup = false;

  constructor(
    @Inject(forwardRef(() => BotManagerWebSocketGateway))
    private readonly wsGateway: BotManagerWebSocketGateway,
    private readonly redisService: RedisService
  ) {}

  /**
   * Инициализация после подключения модулей
   */
  async onModuleInit() {
    // Ждем немного, чтобы RedisService успел подключиться
    await this.delay(1000);
    await this.setupRedisSubscription();
  }

  /**
   * Задержка для ожидания инициализации других сервисов
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Настраивает подписку на Redis канал для получения уведомлений
   */
  private async setupRedisSubscription() {
    if (this.redisSubscriptionSetup) {
      return;
    }

    // Пытаемся подключиться несколько раз с задержкой
    for (let attempt = 0; attempt < 5; attempt++) {
      if (this.redisService.isRedisConnected()) {
        try {
          await this.redisService.subscribe(
            this.REDIS_CHANNEL,
            (notification: Notification) => {
              this.handleNotification(notification);
            }
          );
          this.redisSubscriptionSetup = true;
          this.logger.log(
            `Подписка на Redis канал ${this.REDIS_CHANNEL} установлена`
          );
          return;
        } catch (error) {
          this.logger.error(
            `Ошибка подписки на Redis канал: ${error.message}`,
            error.stack
          );
        }
      }
      await this.delay(1000);
    }

    this.logger.warn(
      `Не удалось установить подписку на Redis канал после нескольких попыток. Продолжаем работу без Redis pub/sub.`
    );
  }

  /**
   * Обрабатывает уведомление, полученное из Redis
   */
  private handleNotification(notification: Notification) {
    try {
      if (notification.userId) {
        // Отправка конкретному пользователю
        this.wsGateway.emitToUser(
          notification.userId,
          notification.type,
          notification.payload
        );
      } else if (notification.room) {
        // Отправка в комнату
        this.wsGateway.emitToRoom(
          notification.room,
          notification.type,
          notification.payload
        );
      } else if (notification.broadcast) {
        // Отправка всем подключенным
        this.wsGateway.emitToAll(notification.type, notification.payload);
      }
    } catch (error) {
      this.logger.error(
        `Ошибка обработки уведомления: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Отправляет уведомление (локально или через Redis для распределенных систем)
   */
  async sendNotification(dto: SendNotificationDto): Promise<void> {
    const notification: Notification = {
      id: uuidv4(),
      type: dto.type,
      payload: dto.payload,
      timestamp: Date.now(),
      userId: dto.userId,
      room: dto.room,
      broadcast: dto.broadcast,
    };

    // Если уведомление для конкретного пользователя, ВСЕГДА сохраняем в Stream
    // Это нужно для центра уведомлений (как для онлайн, так и для офлайн)
    if (dto.userId && this.redisService.isRedisConnected()) {
      try {
        await this.saveNotificationToStream(dto.userId, notification);
      } catch (error) {
        this.logger.error(
          `Ошибка сохранения уведомления в Stream: ${error.message}`
        );
      }
    }

    // Проверяем, подключен ли пользователь
    const isUserOnline = dto.userId
      ? this.wsGateway.isUserConnected(dto.userId)
      : false;

    // Отправляем уведомление через WebSocket для real-time обработки
    // (не только офлайн, но и онлайн пользователям для обновления UI)
    if (!dto.userId || dto.broadcast || dto.room || isUserOnline) {
      // Если Redis доступен, публикуем через него (для масштабируемости)
      if (this.redisService.isRedisConnected()) {
        try {
          await this.redisService.publish(this.REDIS_CHANNEL, notification);
          this.logger.debug(
            `Уведомление отправлено через Redis: ${notification.type}`
          );
        } catch (error) {
          this.logger.warn(
            `Ошибка публикации в Redis, отправляем локально: ${error.message}`
          );
          // Продолжаем выполнение для локальной отправки
          this.handleNotification(notification);
        }
      } else {
        // Локальная отправка
        this.handleNotification(notification);
      }

      // Если пользователь онлайн, отправляем обновление счетчика непрочитанных
      if (isUserOnline && dto.userId) {
        await this.sendUnreadCountUpdate(dto.userId);
      }
    } else {
      // Пользователь офлайн, уведомление уже сохранено в Stream
      this.logger.debug(
        `Пользователь ${dto.userId} офлайн. Уведомление ${notification.type} сохранено в Stream`
      );
    }
  }

  /**
   * Сохраняет уведомление в Redis Stream для пользователя
   */
  private async saveNotificationToStream(
    userId: string,
    notification: Notification
  ): Promise<void> {
    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      // Сохраняем уведомление в Stream
      const data = {
        id: notification.id,
        type: notification.type,
        payload: JSON.stringify(notification.payload),
        timestamp: notification.timestamp.toString(),
        read: "false", // По умолчанию непрочитанное
      };

      await this.redisService.addToStream(streamKey, data);

      // Обрезаем стрим до максимального размера
      await this.redisService.trimStream(
        streamKey,
        this.MAX_PENDING_NOTIFICATIONS
      );

      this.logger.debug(
        `Уведомление сохранено в Stream для пользователя ${userId}`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка сохранения в Stream: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Отправляет уведомление конкретному пользователю
   */
  async sendToUser(
    userId: string,
    type: NotificationType,
    payload: any
  ): Promise<void> {
    await this.sendNotification({
      type,
      payload,
      userId,
    });
  }

  /**
   * Отправляет уведомление в комнату
   */
  async sendToRoom(
    room: string,
    type: NotificationType,
    payload: any
  ): Promise<void> {
    await this.sendNotification({
      type,
      payload,
      room,
    });
  }

  /**
   * Отправляет уведомление всем подключенным пользователям
   */
  async broadcast(type: NotificationType, payload: any): Promise<void> {
    await this.sendNotification({
      type,
      payload,
      broadcast: true,
    });
  }

  /**
   * Отправляет системное уведомление
   */
  async sendSystemNotification(
    message: string,
    userId?: string,
    level: "info" | "warning" | "error" = "info"
  ): Promise<void> {
    await this.sendNotification({
      type: NotificationType.SYSTEM_NOTIFICATION,
      payload: {
        message,
        level,
        timestamp: new Date().toISOString(),
      },
      userId,
      broadcast: !userId,
    });
  }

  /**
   * Отправляет уведомление об ошибке
   */
  async sendError(error: Error | string, userId?: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    await this.sendNotification({
      type: NotificationType.ERROR,
      payload: {
        message: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
      },
      userId,
      broadcast: !userId,
    });
  }

  /**
   * Получает накопленные уведомления для пользователя и отправляет их
   * Вызывается при подключении пользователя к WebSocket
   */
  async sendPendingNotifications(userId: string): Promise<number> {
    if (!this.redisService.isRedisConnected()) {
      return 0;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      // Сначала очищаем старые уведомления
      await this.cleanupOldNotifications(userId);

      // Читаем все сообщения из стрима
      const messages = await this.redisService.readFromStream(streamKey, "0");

      if (messages.length === 0) {
        this.logger.debug(
          `Нет накопленных уведомлений для пользователя ${userId}`
        );
        return 0;
      }

      this.logger.log(
        `Отправка ${messages.length} накопленных уведомлений пользователю ${userId}`
      );

      // Отправляем каждое уведомление
      const messageIds: string[] = [];
      for (const msg of messages) {
        try {
          const notification: Notification = {
            id: msg.message.id,
            type: msg.message.type as NotificationType,
            payload: JSON.parse(msg.message.payload),
            timestamp: parseInt(msg.message.timestamp, 10),
            userId,
          };

          // Отправляем уведомление пользователю
          this.wsGateway.emitToUser(
            userId,
            notification.type,
            notification.payload
          );
          messageIds.push(msg.id);
        } catch (error) {
          this.logger.error(
            `Ошибка отправки накопленного уведомления ${msg.id}: ${error.message}`
          );
        }
      }

      // Удаляем отправленные сообщения из стрима
      if (messageIds.length > 0) {
        await this.redisService.deleteFromStream(streamKey, messageIds);
        this.logger.debug(
          `Удалено ${messageIds.length} уведомлений из Stream пользователя ${userId}`
        );
      }

      return messageIds.length;
    } catch (error) {
      this.logger.error(
        `Ошибка получения накопленных уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
      return 0;
    }
  }

  /**
   * Удаляет старые уведомления для пользователя
   */
  async cleanupOldNotifications(userId: string): Promise<void> {
    if (!this.redisService.isRedisConnected()) {
      return;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;
    const ttlMs = this.NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Date.now() - ttlMs;

    try {
      // Читаем все сообщения
      const messages = await this.redisService.readFromStream(streamKey, "0");

      // Находим сообщения старше TTL
      const oldMessageIds = messages
        .filter((msg) => parseInt(msg.message.timestamp, 10) < cutoffTimestamp)
        .map((msg) => msg.id);

      if (oldMessageIds.length > 0) {
        await this.redisService.deleteFromStream(streamKey, oldMessageIds);
        this.logger.log(
          `Удалено ${oldMessageIds.length} старых уведомлений для пользователя ${userId}`
        );
      }

      // Также удаляем прочитанные уведомления старше READ_RETENTION_DAYS
      await this.cleanupReadNotifications(userId);
    } catch (error) {
      this.logger.error(
        `Ошибка очистки старых уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Удаляет прочитанные уведомления старше READ_RETENTION_DAYS
   */
  async cleanupReadNotifications(userId: string): Promise<void> {
    if (!this.redisService.isRedisConnected()) {
      return;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;
    const readTtlMs = this.READ_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Date.now() - readTtlMs;

    try {
      // Читаем все сообщения
      const messages = await this.redisService.readFromStream(streamKey, "0");

      // Находим прочитанные сообщения старше READ_RETENTION_DAYS
      const readOldMessageIds = messages
        .filter(
          (msg) =>
            msg.message.read === "true" &&
            parseInt(msg.message.timestamp, 10) < cutoffTimestamp
        )
        .map((msg) => msg.id);

      if (readOldMessageIds.length > 0) {
        await this.redisService.deleteFromStream(streamKey, readOldMessageIds);
        this.logger.log(
          `Удалено ${readOldMessageIds.length} прочитанных уведомлений (старше ${this.READ_RETENTION_DAYS} дней) для пользователя ${userId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка очистки прочитанных уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Удаляет все уведомления пользователя (например, при удалении аккаунта)
   */
  async deleteUserNotifications(userId: string): Promise<void> {
    if (!this.redisService.isRedisConnected()) {
      return;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      await this.redisService.deleteStream(streamKey);
      this.logger.log(`Все уведомления удалены для пользователя ${userId}`);
    } catch (error) {
      this.logger.error(
        `Ошибка удаления уведомлений пользователя ${userId}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Получает количество накопленных уведомлений для пользователя
   */
  async getPendingNotificationsCount(userId: string): Promise<number> {
    if (!this.redisService.isRedisConnected()) {
      return 0;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      return await this.redisService.getStreamLength(streamKey);
    } catch (error) {
      this.logger.error(
        `Ошибка получения количества уведомлений для пользователя ${userId}: ${error.message}`
      );
      return 0;
    }
  }

  /**
   * Получает список уведомлений для пользователя
   */
  async getNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<NotificationListDto> {
    if (!this.redisService.isRedisConnected()) {
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      // Читаем все сообщения из стрима
      const messages = await this.redisService.readFromStream(streamKey, "0");

      // Преобразуем в NotificationItemDto
      let notifications: NotificationItemDto[] = messages.map((msg) => ({
        id: msg.message.id,
        type: msg.message.type as NotificationType,
        payload: JSON.parse(msg.message.payload),
        timestamp: parseInt(msg.message.timestamp, 10),
        read: msg.message.read === "true",
        createdAt: new Date(parseInt(msg.message.timestamp, 10)),
      }));

      // Подсчитываем непрочитанные
      const unreadCount = notifications.filter((n) => !n.read).length;

      // Фильтруем по непрочитанным, если нужно
      if (unreadOnly) {
        notifications = notifications.filter((n) => !n.read);
      }

      // Сортируем по времени (новые первыми)
      notifications.sort((a, b) => b.timestamp - a.timestamp);

      // Применяем пагинацию
      const total = notifications.length;
      notifications = notifications.slice(offset, offset + limit);

      return {
        notifications,
        total,
        unreadCount,
      };
    } catch (error) {
      this.logger.error(
        `Ошибка получения списка уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };
    }
  }

  /**
   * Получает сводку уведомлений (по типам)
   */
  async getNotificationsSummary(
    userId: string
  ): Promise<NotificationSummaryDto[]> {
    if (!this.redisService.isRedisConnected()) {
      return [];
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      const messages = await this.redisService.readFromStream(streamKey, "0");

      // Группируем по типам
      const summaryMap = new Map<
        NotificationType,
        { count: number; latestTimestamp: number }
      >();

      messages.forEach((msg) => {
        const type = msg.message.type as NotificationType;
        const timestamp = parseInt(msg.message.timestamp, 10);
        const isRead = msg.message.read === "true";

        // Учитываем только непрочитанные
        if (!isRead) {
          const current = summaryMap.get(type) || {
            count: 0,
            latestTimestamp: 0,
          };
          summaryMap.set(type, {
            count: current.count + 1,
            latestTimestamp: Math.max(current.latestTimestamp, timestamp),
          });
        }
      });

      // Преобразуем в массив
      const summary: NotificationSummaryDto[] = Array.from(
        summaryMap.entries()
      ).map(([type, data]) => ({
        type,
        count: data.count,
        latestTimestamp: data.latestTimestamp,
      }));

      // Сортируем по последнему времени
      summary.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

      return summary;
    } catch (error) {
      this.logger.error(
        `Ошибка получения сводки уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  /**
   * Помечает уведомления как прочитанные
   */
  async markNotificationsAsRead(
    userId: string,
    notificationIds?: string[]
  ): Promise<number> {
    if (!this.redisService.isRedisConnected()) {
      return 0;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      // Читаем все сообщения
      const messages = await this.redisService.readFromStream(streamKey, "0");

      let updatedCount = 0;

      // Находим сообщения для обновления
      const messagesToUpdate = notificationIds
        ? messages.filter((msg) => notificationIds.includes(msg.message.id))
        : messages;

      // В Redis Streams нельзя обновить существующую запись
      // Поэтому удаляем старые и добавляем новые с флагом read=true
      const idsToDelete: string[] = [];
      const dataToAdd: Array<Record<string, string>> = [];

      for (const msg of messagesToUpdate) {
        if (msg.message.read !== "true") {
          idsToDelete.push(msg.id);
          dataToAdd.push({
            ...msg.message,
            read: "true",
          });
          updatedCount++;
        }
      }

      // Удаляем старые записи
      if (idsToDelete.length > 0) {
        await this.redisService.deleteFromStream(streamKey, idsToDelete);
      }

      // Добавляем обновленные записи
      for (const data of dataToAdd) {
        await this.redisService.addToStream(streamKey, data);
      }

      this.logger.log(
        `Помечено ${updatedCount} уведомлений как прочитанные для пользователя ${userId}`
      );
      return updatedCount;
    } catch (error) {
      this.logger.error(
        `Ошибка пометки уведомлений как прочитанные для пользователя ${userId}: ${error.message}`,
        error.stack
      );
      return 0;
    }
  }

  /**
   * Получает количество непрочитанных уведомлений
   */
  async getUnreadNotificationsCount(userId: string): Promise<number> {
    if (!this.redisService.isRedisConnected()) {
      return 0;
    }

    const streamKey = `${this.STREAM_PREFIX}${userId}`;

    try {
      const messages = await this.redisService.readFromStream(streamKey, "0");
      return messages.filter((msg) => msg.message.read !== "true").length;
    } catch (error) {
      this.logger.error(
        `Ошибка получения количества непрочитанных уведомлений для пользователя ${userId}: ${error.message}`
      );
      return 0;
    }
  }

  /**
   * Отправляет обновление счетчика непрочитанных уведомлений
   */
  async sendUnreadCountUpdate(userId: string): Promise<void> {
    try {
      const unreadCount = await this.getUnreadNotificationsCount(userId);
      this.wsGateway.emitToUser(userId, "notifications.unread_count", {
        count: unreadCount,
      });
      this.logger.debug(
        `Обновление счетчика отправлено пользователю ${userId}: ${unreadCount}`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка отправки обновления счетчика для пользователя ${userId}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Отправляет сводку уведомлений через WebSocket
   */
  async sendNotificationsSummary(userId: string): Promise<void> {
    try {
      const unreadCount = await this.getUnreadNotificationsCount(userId);
      const summary = await this.getNotificationsSummary(userId);

      this.wsGateway.emitToUser(userId, "notifications.summary", {
        unreadCount,
        summary,
      });

      this.logger.debug(
        `Сводка уведомлений отправлена пользователю ${userId}: ${unreadCount} непрочитанных`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка отправки сводки уведомлений для пользователя ${userId}: ${error.message}`,
        error.stack
      );
    }
  }
}
