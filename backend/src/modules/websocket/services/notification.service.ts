import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { BotManagerWebSocketGateway } from "../websocket.gateway";
import { RedisService } from "./redis.service";
import { Notification, NotificationType, SendNotificationDto } from "../interfaces/notification.interface";
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
  private redisSubscriptionSetup = false;

  constructor(
    @Inject(forwardRef(() => BotManagerWebSocketGateway))
    private readonly wsGateway: BotManagerWebSocketGateway,
    private readonly redisService: RedisService,
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
    return new Promise(resolve => setTimeout(resolve, ms));
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
          await this.redisService.subscribe(this.REDIS_CHANNEL, (notification: Notification) => {
            this.handleNotification(notification);
          });
          this.redisSubscriptionSetup = true;
          this.logger.log(`Подписка на Redis канал ${this.REDIS_CHANNEL} установлена`);
          return;
        } catch (error) {
          this.logger.error(`Ошибка подписки на Redis канал: ${error.message}`, error.stack);
        }
      }
      await this.delay(1000);
    }
    
    this.logger.warn(`Не удалось установить подписку на Redis канал после нескольких попыток. Продолжаем работу без Redis pub/sub.`);
  }

  /**
   * Обрабатывает уведомление, полученное из Redis
   */
  private handleNotification(notification: Notification) {
    try {
      if (notification.userId) {
        // Отправка конкретному пользователю
        this.wsGateway.emitToUser(notification.userId, notification.type, notification.payload);
      } else if (notification.room) {
        // Отправка в комнату
        this.wsGateway.emitToRoom(notification.room, notification.type, notification.payload);
      } else if (notification.broadcast) {
        // Отправка всем подключенным
        this.wsGateway.emitToAll(notification.type, notification.payload);
      }
    } catch (error) {
      this.logger.error(`Ошибка обработки уведомления: ${error.message}`, error.stack);
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

    // Если уведомление для конкретного пользователя, сохраняем в Stream
    if (dto.userId && this.redisService.isRedisConnected()) {
      try {
        await this.saveNotificationToStream(dto.userId, notification);
      } catch (error) {
        this.logger.error(`Ошибка сохранения уведомления в Stream: ${error.message}`);
      }
    }

    // Проверяем, подключен ли пользователь
    const isUserOnline = dto.userId ? this.wsGateway.isUserConnected(dto.userId) : false;

    // Если пользователь онлайн или это широковещательное сообщение
    if (isUserOnline || !dto.userId || dto.broadcast || dto.room) {
      // Если Redis доступен, публикуем через него (для масштабируемости)
      if (this.redisService.isRedisConnected()) {
        try {
          await this.redisService.publish(this.REDIS_CHANNEL, notification);
          this.logger.debug(`Уведомление отправлено через Redis: ${notification.type}`);
          return;
        } catch (error) {
          this.logger.warn(`Ошибка публикации в Redis, отправляем локально: ${error.message}`);
          // Продолжаем выполнение для локальной отправки
        }
      }

      // Локальная отправка
      this.handleNotification(notification);
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
  private async saveNotificationToStream(userId: string, notification: Notification): Promise<void> {
    const streamKey = `${this.STREAM_PREFIX}${userId}`;
    
    try {
      // Сохраняем уведомление в Stream
      const data = {
        id: notification.id,
        type: notification.type,
        payload: JSON.stringify(notification.payload),
        timestamp: notification.timestamp.toString(),
      };

      await this.redisService.addToStream(streamKey, data);

      // Обрезаем стрим до максимального размера
      await this.redisService.trimStream(streamKey, this.MAX_PENDING_NOTIFICATIONS);

      this.logger.debug(`Уведомление сохранено в Stream для пользователя ${userId}`);
    } catch (error) {
      this.logger.error(`Ошибка сохранения в Stream: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Отправляет уведомление конкретному пользователю
   */
  async sendToUser(userId: string, type: NotificationType, payload: any): Promise<void> {
    await this.sendNotification({
      type,
      payload,
      userId,
    });
  }

  /**
   * Отправляет уведомление в комнату
   */
  async sendToRoom(room: string, type: NotificationType, payload: any): Promise<void> {
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
  async sendSystemNotification(message: string, userId?: string, level: "info" | "warning" | "error" = "info"): Promise<void> {
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
        this.logger.debug(`Нет накопленных уведомлений для пользователя ${userId}`);
        return 0;
      }

      this.logger.log(`Отправка ${messages.length} накопленных уведомлений пользователю ${userId}`);

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
          this.wsGateway.emitToUser(userId, notification.type, notification.payload);
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
        this.logger.debug(`Удалено ${messageIds.length} уведомлений из Stream пользователя ${userId}`);
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
    } catch (error) {
      this.logger.error(
        `Ошибка очистки старых уведомлений для пользователя ${userId}: ${error.message}`,
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
}

