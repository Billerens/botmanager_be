import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, RedisClientType } from "redis";

/**
 * Сервис для работы с Redis (pub/sub)
 * Используется для масштабируемости WebSocket между несколькими инстансами
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const redisConfig = this.configService.get("redis");
      
      const redisOptions = {
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          reconnectStrategy: redisConfig.retryStrategy,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      };

      // Создаем два клиента: один для публикации, другой для подписки
      this.publisher = createClient(redisOptions) as RedisClientType;
      this.subscriber = createClient(redisOptions) as RedisClientType;

      // Обработка ошибок
      this.publisher.on("error", (err) => {
        this.logger.error(`Redis Publisher Error: ${err.message}`, err.stack);
      });

      this.subscriber.on("error", (err) => {
        this.logger.error(`Redis Subscriber Error: ${err.message}`, err.stack);
      });

      // Подключение
      await this.publisher.connect();
      await this.subscriber.connect();

      this.isConnected = true;
      this.logger.log("Redis подключен успешно (pub/sub)");
    } catch (error) {
      this.logger.error(`Ошибка подключения к Redis: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async disconnect() {
    try {
      if (this.publisher) {
        await this.publisher.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      this.isConnected = false;
      this.logger.log("Redis отключен");
    } catch (error) {
      this.logger.error(`Ошибка отключения от Redis: ${error.message}`, error.stack);
    }
  }

  /**
   * Публикует сообщение в Redis канал
   */
  async publish(channel: string, message: any): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      this.logger.debug(`Сообщение опубликовано в канал ${channel}`);
    } catch (error) {
      this.logger.error(`Ошибка публикации в Redis: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Подписывается на канал Redis
   */
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      throw new Error("Redis не подключен");
    }

    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          this.logger.error(`Ошибка парсинга сообщения из Redis: ${error.message}`);
          callback(message);
        }
      });
      this.logger.debug(`Подписка на канал ${channel} установлена`);
    } catch (error) {
      this.logger.error(`Ошибка подписки на Redis канал: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Отписывается от канала Redis
   */
  async unsubscribe(channel: string): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      return;
    }

    try {
      await this.subscriber.unsubscribe(channel);
      this.logger.debug(`Отписка от канала ${channel}`);
    } catch (error) {
      this.logger.error(`Ошибка отписки от Redis канала: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверяет подключение к Redis
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }
}

