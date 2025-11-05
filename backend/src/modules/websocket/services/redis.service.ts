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

  /**
   * Добавляет сообщение в Redis Stream
   * @param streamKey - ключ стрима (например, "notifications:user:123")
   * @param data - данные для сохранения
   * @returns ID записи в стриме
   */
  async addToStream(streamKey: string, data: Record<string, string>): Promise<string> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      const id = await this.publisher.xAdd(streamKey, "*", data);
      this.logger.debug(`Сообщение добавлено в стрим ${streamKey}, ID: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Ошибка добавления в стрим: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Читает сообщения из Redis Stream
   * @param streamKey - ключ стрима
   * @param startId - ID с которого начинать чтение (0 - с начала, $ - только новые)
   * @param count - максимальное количество сообщений
   * @returns массив сообщений
   */
  async readFromStream(
    streamKey: string,
    startId: string = "0",
    count: number = 100
  ): Promise<Array<{ id: string; message: Record<string, string> }>> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      const result = await this.publisher.xRead(
        { key: streamKey, id: startId },
        { COUNT: count }
      );

      if (!result || result.length === 0) {
        return [];
      }

      const messages = result[0].messages.map((msg) => ({
        id: msg.id,
        message: msg.message,
      }));

      this.logger.debug(`Прочитано ${messages.length} сообщений из стрима ${streamKey}`);
      return messages;
    } catch (error) {
      this.logger.error(`Ошибка чтения из стрима: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Удаляет сообщения из Redis Stream
   * @param streamKey - ключ стрима
   * @param ids - массив ID сообщений для удаления
   * @returns количество удаленных сообщений
   */
  async deleteFromStream(streamKey: string, ids: string[]): Promise<number> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      const deletedCount = await this.publisher.xDel(streamKey, ids);
      this.logger.debug(`Удалено ${deletedCount} сообщений из стрима ${streamKey}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Ошибка удаления из стрима: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Обрезает стрим до указанной длины (удаляет старые сообщения)
   * @param streamKey - ключ стрима
   * @param maxLength - максимальная длина стрима
   * @param approximate - использовать приблизительную обрезку (быстрее)
   */
  async trimStream(streamKey: string, maxLength: number, approximate = true): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      await this.publisher.xTrim(streamKey, approximate ? "MAXLEN" : "MAXLEN", maxLength, {
        strategyModifier: approximate ? "~" : undefined,
      });
      this.logger.debug(`Стрим ${streamKey} обрезан до ${maxLength} сообщений`);
    } catch (error) {
      this.logger.error(`Ошибка обрезки стрима: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает длину стрима
   * @param streamKey - ключ стрима
   * @returns количество сообщений в стриме
   */
  async getStreamLength(streamKey: string): Promise<number> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      const length = await this.publisher.xLen(streamKey);
      return length;
    } catch (error) {
      this.logger.error(`Ошибка получения длины стрима: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Удаляет стрим полностью
   * @param streamKey - ключ стрима
   */
  async deleteStream(streamKey: string): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      await this.publisher.del(streamKey);
      this.logger.debug(`Стрим ${streamKey} удален`);
    } catch (error) {
      this.logger.error(`Ошибка удаления стрима: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получает все ключи стримов по паттерну
   * @param pattern - паттерн для поиска (например, "notifications:user:*")
   * @returns массив ключей
   */
  async getStreamKeys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.publisher) {
      throw new Error("Redis не подключен");
    }

    try {
      const keys = await this.publisher.keys(pattern);
      return keys;
    } catch (error) {
      this.logger.error(`Ошибка получения ключей стримов: ${error.message}`, error.stack);
      return [];
    }
  }
}

