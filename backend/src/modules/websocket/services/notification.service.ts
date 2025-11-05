import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
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
  private redisSubscriptionSetup = false;

  constructor(
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

    // Локальная отправка (если Redis недоступен или для простых случаев)
    this.handleNotification(notification);
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
}

