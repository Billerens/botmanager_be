import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue, Job } from "bull";
import { v4 as uuidv4 } from "uuid";

/**
 * Статусы периодической задачи
 */
export type PeriodicTaskStatus =
  | "running"
  | "paused"
  | "stopped"
  | "completed";

/**
 * Конфигурация периодической задачи
 */
export interface PeriodicTaskConfig {
  scheduleType: "interval" | "cron";
  interval?: {
    value: number;
    unit: "seconds" | "minutes" | "hours" | "days";
  };
  cronExpression?: string;
  maxExecutions?: number | null;
  // Контекст выполнения
  botId: string;
  flowId: string;
  nodeId: string; // nodeId узла periodic_execution в flow
  userId: string;
  chatId: string;
  sessionKey: string;
}

/**
 * Метаданные задачи, хранящиеся in-memory для управления
 */
interface TaskMetadata {
  taskId: string;
  config: PeriodicTaskConfig;
  status: PeriodicTaskStatus;
  executionCount: number;
  createdAt: Date;
  lastExecutedAt?: Date;
  bullJobKey?: string; // Ключ repeatable job в BullMQ
}

/**
 * Сервис управления периодическими задачами через BullMQ repeatable jobs.
 *
 * Активные задачи персистятся в Redis через BullMQ.
 * Метаданные (конфиги паузированных задач, счетчики) хранятся in-memory.
 *
 * Сложность операций: O(1) для CRUD по taskId (Map lookup).
 */
@Injectable()
export class PeriodicTaskService {
  private readonly logger = new Logger(PeriodicTaskService.name);

  /**
   * In-memory хранилище метаданных задач.
   * Ключ — taskId (UUID).
   */
  private tasks = new Map<string, TaskMetadata>();

  constructor(
    @InjectQueue("periodic-tasks") private readonly periodicQueue: Queue,
  ) {}

  /**
   * Конвертирует интервал в миллисекунды.
   * O(1) — простое вычисление.
   */
  private intervalToMs(interval: {
    value: number;
    unit: "seconds" | "minutes" | "hours" | "days";
  }): number {
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };
    return interval.value * (multipliers[interval.unit] || 1000);
  }

  /**
   * Создает новую периодическую задачу.
   *
   * @returns taskId — UUID созданной задачи
   * @throws Error если конфигурация невалидна
   *
   * Потенциальные риски:
   * - Если Redis недоступен, BullMQ выбросит ошибку
   * - При большом количестве задач память растет линейно (Map in-memory)
   */
  async createTask(config: PeriodicTaskConfig): Promise<string> {
    const taskId = uuidv4();

    this.logger.log(
      `Создание периодической задачи ${taskId}: ${config.scheduleType}, bot=${config.botId}, node=${config.nodeId}`,
    );

    // Формируем опции для repeatable job
    const repeatOpts: any = {};
    if (config.scheduleType === "cron" && config.cronExpression) {
      repeatOpts.cron = config.cronExpression;
    } else if (config.scheduleType === "interval" && config.interval) {
      repeatOpts.every = this.intervalToMs(config.interval);
    } else {
      throw new Error(
        `Невалидная конфигурация расписания: scheduleType=${config.scheduleType}`,
      );
    }

    // Ограничение по количеству выполнений
    if (config.maxExecutions && config.maxExecutions > 0) {
      repeatOpts.limit = config.maxExecutions;
    }

    // Добавляем jobId для идентификации
    repeatOpts.jobId = taskId;

    const job = await this.periodicQueue.add(
      "execute",
      {
        taskId,
        botId: config.botId,
        flowId: config.flowId,
        nodeId: config.nodeId,
        userId: config.userId,
        chatId: config.chatId,
        sessionKey: config.sessionKey,
      },
      {
        repeat: repeatOpts,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    // Сохраняем метаданные
    const metadata: TaskMetadata = {
      taskId,
      config,
      status: "running",
      executionCount: 0,
      createdAt: new Date(),
      bullJobKey: (job.opts?.repeat as any)?.key,
    };

    this.tasks.set(taskId, metadata);

    this.logger.log(`Периодическая задача ${taskId} создана успешно`);
    return taskId;
  }

  /**
   * Останавливает задачу и удаляет repeatable job из BullMQ.
   *
   * @returns true если задача найдена и остановлена
   */
  async stopTask(taskId: string): Promise<boolean> {
    const metadata = this.tasks.get(taskId);
    if (!metadata) {
      this.logger.warn(`Задача ${taskId} не найдена`);
      return false;
    }

    this.logger.log(`Остановка задачи ${taskId}`);

    // Удаляем repeatable job из BullMQ
    await this.removeRepeatableJob(metadata);

    metadata.status = "stopped";
    this.tasks.set(taskId, metadata);

    this.logger.log(`Задача ${taskId} остановлена`);
    return true;
  }

  /**
   * Приостанавливает задачу. Конфигурация сохраняется для resume.
   */
  async pauseTask(taskId: string): Promise<boolean> {
    const metadata = this.tasks.get(taskId);
    if (!metadata) {
      this.logger.warn(`Задача ${taskId} не найдена`);
      return false;
    }

    if (metadata.status !== "running") {
      this.logger.warn(
        `Задача ${taskId} не запущена (текущий статус: ${metadata.status})`,
      );
      return false;
    }

    this.logger.log(`Пауза задачи ${taskId}`);

    // Удаляем repeatable job, но сохраняем конфиг для resume
    await this.removeRepeatableJob(metadata);

    metadata.status = "paused";
    this.tasks.set(taskId, metadata);

    this.logger.log(`Задача ${taskId} приостановлена`);
    return true;
  }

  /**
   * Возобновляет паузированную задачу, пересоздавая repeatable job.
   */
  async resumeTask(taskId: string): Promise<boolean> {
    const metadata = this.tasks.get(taskId);
    if (!metadata) {
      this.logger.warn(`Задача ${taskId} не найдена`);
      return false;
    }

    if (metadata.status !== "paused") {
      this.logger.warn(
        `Задача ${taskId} не на паузе (текущий статус: ${metadata.status})`,
      );
      return false;
    }

    this.logger.log(`Возобновление задачи ${taskId}`);

    // Пересоздаем repeatable job с той же конфигурацией
    const config = metadata.config;
    const repeatOpts: any = {};

    if (config.scheduleType === "cron" && config.cronExpression) {
      repeatOpts.cron = config.cronExpression;
    } else if (config.scheduleType === "interval" && config.interval) {
      repeatOpts.every = this.intervalToMs(config.interval);
    }

    if (config.maxExecutions && config.maxExecutions > 0) {
      // Оставшееся количество выполнений
      const remaining = config.maxExecutions - metadata.executionCount;
      if (remaining <= 0) {
        metadata.status = "completed";
        this.tasks.set(taskId, metadata);
        this.logger.log(
          `Задача ${taskId} уже выполнила все итерации (${metadata.executionCount}/${config.maxExecutions})`,
        );
        return false;
      }
      repeatOpts.limit = remaining;
    }

    repeatOpts.jobId = taskId;

    const job = await this.periodicQueue.add(
      "execute",
      {
        taskId,
        botId: config.botId,
        flowId: config.flowId,
        nodeId: config.nodeId,
        userId: config.userId,
        chatId: config.chatId,
        sessionKey: config.sessionKey,
      },
      {
        repeat: repeatOpts,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    metadata.status = "running";
    metadata.bullJobKey = (job.opts?.repeat as any)?.key;
    this.tasks.set(taskId, metadata);

    this.logger.log(`Задача ${taskId} возобновлена`);
    return true;
  }

  /**
   * Получает текущий статус задачи.
   */
  getTaskStatus(
    taskId: string,
  ): {
    status: PeriodicTaskStatus;
    executionCount: number;
    lastExecutedAt?: Date;
    createdAt: Date;
  } | null {
    const metadata = this.tasks.get(taskId);
    if (!metadata) {
      return null;
    }

    return {
      status: metadata.status,
      executionCount: metadata.executionCount,
      lastExecutedAt: metadata.lastExecutedAt,
      createdAt: metadata.createdAt,
    };
  }

  /**
   * Перезапускает задачу (stop + start с той же конфигурацией).
   */
  async restartTask(taskId: string): Promise<boolean> {
    const metadata = this.tasks.get(taskId);
    if (!metadata) {
      this.logger.warn(`Задача ${taskId} не найдена`);
      return false;
    }

    this.logger.log(`Перезапуск задачи ${taskId}`);

    // Останавливаем текущую
    await this.removeRepeatableJob(metadata);

    // Сбрасываем счетчик
    metadata.executionCount = 0;

    // Пересоздаем
    const config = metadata.config;
    const repeatOpts: any = {};

    if (config.scheduleType === "cron" && config.cronExpression) {
      repeatOpts.cron = config.cronExpression;
    } else if (config.scheduleType === "interval" && config.interval) {
      repeatOpts.every = this.intervalToMs(config.interval);
    }

    if (config.maxExecutions && config.maxExecutions > 0) {
      repeatOpts.limit = config.maxExecutions;
    }

    repeatOpts.jobId = taskId;

    const job = await this.periodicQueue.add(
      "execute",
      {
        taskId,
        botId: config.botId,
        flowId: config.flowId,
        nodeId: config.nodeId,
        userId: config.userId,
        chatId: config.chatId,
        sessionKey: config.sessionKey,
      },
      {
        repeat: repeatOpts,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    metadata.status = "running";
    metadata.bullJobKey = (job.opts?.repeat as any)?.key;
    metadata.lastExecutedAt = undefined;
    this.tasks.set(taskId, metadata);

    this.logger.log(`Задача ${taskId} перезапущена`);
    return true;
  }

  /**
   * Инкрементирует счетчик выполнений задачи.
   * Вызывается из процессора при каждом выполнении.
   */
  incrementExecutionCount(taskId: string): void {
    const metadata = this.tasks.get(taskId);
    if (metadata) {
      metadata.executionCount++;
      metadata.lastExecutedAt = new Date();

      // Проверяем лимит выполнений
      if (
        metadata.config.maxExecutions &&
        metadata.config.maxExecutions > 0 &&
        metadata.executionCount >= metadata.config.maxExecutions
      ) {
        metadata.status = "completed";
        this.logger.log(
          `Задача ${taskId} достигла лимита выполнений (${metadata.executionCount}/${metadata.config.maxExecutions})`,
        );
      }

      this.tasks.set(taskId, metadata);
    }
  }

  /**
   * Удаляет repeatable job из BullMQ.
   * Используется внутренне при stop/pause.
   */
  private async removeRepeatableJob(metadata: TaskMetadata): Promise<void> {
    try {
      // Получаем все repeatable jobs и ищем нашу по ключу
      const repeatableJobs = await this.periodicQueue.getRepeatableJobs();
      for (const repeatableJob of repeatableJobs) {
        if (repeatableJob.id === metadata.taskId) {
          await this.periodicQueue.removeRepeatableByKey(repeatableJob.key);
          this.logger.log(
            `Repeatable job удалён для задачи ${metadata.taskId}`,
          );
          return;
        }
      }
      this.logger.warn(
        `Repeatable job не найден для задачи ${metadata.taskId}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка удаления repeatable job для задачи ${metadata.taskId}:`,
        error,
      );
    }
  }

  /**
   * Очистка всех задач для бота (при деактивации flow).
   * O(n) — итерация по всем задачам.
   */
  async cleanupBotTasks(botId: string): Promise<number> {
    let cleaned = 0;
    for (const [taskId, metadata] of this.tasks.entries()) {
      if (metadata.config.botId === botId && metadata.status === "running") {
        await this.removeRepeatableJob(metadata);
        metadata.status = "stopped";
        this.tasks.set(taskId, metadata);
        cleaned++;
      }
    }
    this.logger.log(`Очищено ${cleaned} задач для бота ${botId}`);
    return cleaned;
  }
}
