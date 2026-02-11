import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
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
export class PeriodicTaskService implements OnModuleInit {
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
   * При старте модуля логируем существующие repeatable jobs в Redis.
   *
   * После рестарта in-memory Map пуст, но repeatable jobs живут в Redis.
   * Метаданные будут восстановлены лениво — при первом срабатывании
   * каждого job процессор вызовет restoreTask() с данными из job.data.
   */
  async onModuleInit(): Promise<void> {
    try {
      const repeatableJobs = await this.periodicQueue.getRepeatableJobs();
      if (repeatableJobs.length > 0) {
        this.logger.log(
          `Обнаружено ${repeatableJobs.length} repeatable jobs в Redis. ` +
          `Метаданные будут восстановлены при первом срабатывании.`,
        );
        for (const job of repeatableJobs) {
          this.logger.log(
            `  Repeatable job: id=${job.id}, cron=${job.cron || "N/A"}, every=${job.every || "N/A"}`,
          );
        }
      } else {
        this.logger.log(`Repeatable jobs в Redis не обнаружено`);
      }
    } catch (error) {
      this.logger.error(`Ошибка проверки repeatable jobs:`, error);
    }
  }

  /**
   * Восстанавливает метаданные задачи из данных job после рестарта сервера.
   *
   * Вызывается процессором, когда задача не найдена в in-memory Map,
   * но repeatable job продолжает срабатывать из Redis.
   * Воссоздаёт TaskMetadata из job.data и регистрирует в Map.
   *
   * @param jobData — данные из job.data (содержат taskId, конфиг и контекст)
   * @returns true если задача успешно восстановлена
   */
  restoreTask(jobData: {
    taskId: string;
    botId: string;
    flowId: string;
    nodeId: string;
    userId: string;
    chatId: string;
    sessionKey: string;
    scheduleType?: string;
    interval?: { value: number; unit: string };
    cronExpression?: string;
    maxExecutions?: number | null;
  }): boolean {
    // Если задача уже есть в Map — не перезаписываем (race condition guard)
    if (this.tasks.has(jobData.taskId)) {
      return true;
    }

    // Для старых задач, созданных до добавления scheduleType в job.data,
    // восстановление невозможно — они будут очищены
    if (!jobData.scheduleType) {
      this.logger.warn(
        `Задача ${jobData.taskId} не содержит scheduleType в job.data (старый формат), ` +
        `восстановление невозможно`,
      );
      return false;
    }

    const config: PeriodicTaskConfig = {
      scheduleType: jobData.scheduleType as "interval" | "cron",
      interval: jobData.interval as PeriodicTaskConfig["interval"],
      cronExpression: jobData.cronExpression,
      maxExecutions: jobData.maxExecutions,
      botId: jobData.botId,
      flowId: jobData.flowId,
      nodeId: jobData.nodeId,
      userId: jobData.userId,
      chatId: jobData.chatId,
      sessionKey: jobData.sessionKey,
    };

    const metadata: TaskMetadata = {
      taskId: jobData.taskId,
      config,
      status: "running",
      executionCount: 0, // Счётчик сбрасывается (не персистится)
      createdAt: new Date(), // Время восстановления
    };

    this.tasks.set(jobData.taskId, metadata);

    this.logger.log(
      `Задача ${jobData.taskId} восстановлена после рестарта: ` +
      `${config.scheduleType}, bot=${config.botId}, node=${config.nodeId}`,
    );

    return true;
  }

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
        // Конфиг расписания — для восстановления метаданных после рестарта сервера
        scheduleType: config.scheduleType,
        interval: config.interval,
        cronExpression: config.cronExpression,
        maxExecutions: config.maxExecutions,
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
        scheduleType: config.scheduleType,
        interval: config.interval,
        cronExpression: config.cronExpression,
        maxExecutions: config.maxExecutions,
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
        scheduleType: config.scheduleType,
        interval: config.interval,
        cronExpression: config.cronExpression,
        maxExecutions: config.maxExecutions,
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
   * Удаляет осиротевший repeatable job по taskId.
   *
   * Используется процессором, когда задача не найдена в in-memory Map
   * (например, после рестарта сервера). В этом случае метаданных нет,
   * но repeatable job продолжает срабатывать из Redis.
   *
   * @returns true если job найден и удалён
   */
  async removeOrphanedJob(taskId: string): Promise<boolean> {
    try {
      const repeatableJobs = await this.periodicQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === taskId) {
          await this.periodicQueue.removeRepeatableByKey(job.key);
          this.logger.log(
            `Удалён осиротевший repeatable job для taskId=${taskId}`,
          );
          return true;
        }
      }
      this.logger.warn(
        `Осиротевший repeatable job для taskId=${taskId} не найден в Redis`,
      );
      return false;
    } catch (error) {
      this.logger.error(
        `Ошибка удаления осиротевшего repeatable job для taskId=${taskId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Сравнивает конфигурацию расписания двух конфигов.
   * @returns true если расписание изменилось
   */
  private hasScheduleChanged(
    oldConfig: PeriodicTaskConfig,
    newConfig: {
      scheduleType: string;
      interval?: { value: number; unit: string };
      cronExpression?: string;
      maxExecutions?: number | null;
    },
  ): boolean {
    if (oldConfig.scheduleType !== newConfig.scheduleType) return true;

    if (oldConfig.scheduleType === "interval") {
      if (
        oldConfig.interval?.value !== newConfig.interval?.value ||
        oldConfig.interval?.unit !== newConfig.interval?.unit
      ) {
        return true;
      }
    }

    if (oldConfig.scheduleType === "cron") {
      if (oldConfig.cronExpression !== newConfig.cronExpression) return true;
    }

    if (oldConfig.maxExecutions !== newConfig.maxExecutions) return true;

    return false;
  }

  /**
   * Согласует запущенные задачи с текущим состоянием узлов flow.
   *
   * Вызывается при сохранении flow. Алгоритм:
   * 1. Находит все running/paused задачи для данного flowId
   * 2. Для каждой задачи проверяет, существует ли узел с тем же nodeId
   * 3. Если узел удалён → stopTask
   * 4. Если настройки (interval, cron, maxExecutions) изменились → restartTask с новым конфигом
   * 5. Если узел не изменился → ничего не делаем
   *
   * @param flowId — ID flow
   * @param periodicNodes — массив узлов periodic_execution из нового flow
   * @returns количество изменённых задач
   *
   * O(n*m) — n задач, m узлов. На практике оба числа малы (единицы).
   */
  async reconcileFlowTasks(
    flowId: string,
    periodicNodes: Array<{
      nodeId: string;
      data?: {
        periodicExecution?: {
          scheduleType: string;
          interval?: { value: number; unit: string };
          cronExpression?: string;
          maxExecutions?: number | null;
          mode?: string;
          taskIdVariable?: string;
        };
      };
    }>,
  ): Promise<number> {
    let changed = 0;

    // Находим все активные задачи для этого flow
    const flowTasks: TaskMetadata[] = [];
    for (const [, metadata] of this.tasks.entries()) {
      if (
        metadata.config.flowId === flowId &&
        (metadata.status === "running" || metadata.status === "paused")
      ) {
        flowTasks.push(metadata);
      }
    }

    if (flowTasks.length === 0) {
      this.logger.log(`Нет активных задач для flow ${flowId}, reconcile не требуется`);
      return 0;
    }

    this.logger.log(
      `Reconcile: ${flowTasks.length} активных задач для flow ${flowId}, ${periodicNodes.length} periodic_execution узлов`,
    );

    for (const task of flowTasks) {
      const matchingNode = periodicNodes.find(
        (node) => node.nodeId === task.config.nodeId,
      );

      if (!matchingNode || !matchingNode.data?.periodicExecution) {
        // Узел удалён из flow → останавливаем задачу
        this.logger.log(
          `Reconcile: узел ${task.config.nodeId} удалён из flow, останавливаем задачу ${task.taskId}`,
        );
        await this.stopTask(task.taskId);
        changed++;
        continue;
      }

      const newConfig = matchingNode.data.periodicExecution;

      // Проверяем, изменились ли настройки расписания
      if (this.hasScheduleChanged(task.config, newConfig)) {
        this.logger.log(
          `Reconcile: настройки узла ${task.config.nodeId} изменились, перезапускаем задачу ${task.taskId}`,
        );

        // Обновляем конфиг задачи
        task.config.scheduleType = newConfig.scheduleType as "interval" | "cron";
        task.config.interval = newConfig.interval as PeriodicTaskConfig["interval"];
        task.config.cronExpression = newConfig.cronExpression;
        task.config.maxExecutions = newConfig.maxExecutions;
        this.tasks.set(task.taskId, task);

        // Перезапускаем с новым конфигом
        await this.restartTask(task.taskId);
        changed++;
      } else {
        this.logger.log(
          `Reconcile: задача ${task.taskId} (узел ${task.config.nodeId}) не изменилась`,
        );
      }
    }

    this.logger.log(`Reconcile завершён: ${changed} задач изменено`);
    return changed;
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
