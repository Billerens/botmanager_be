import { Process, Processor } from "@nestjs/bull";
import { Logger, Inject, forwardRef } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { Bot, BotStatus } from "../../../database/entities/bot.entity";
import { BotsService } from "../bots.service";
import { TelegramBlockedError } from "../../telegram/telegram.service";
import { SessionStorageService } from "../session-storage.service";
import { PeriodicTaskService } from "../services/periodic-task.service";
import { FlowExecutionService } from "../flow-execution.service";

/**
 * Процессор BullMQ очереди periodic-tasks.
 *
 * Обрабатывает repeatable jobs, создаваемые PeriodicExecutionNodeHandler.
 * При каждом срабатывании загружает flow, находит дочерние узлы
 * periodic_execution и последовательно выполняет ветку.
 */
@Processor("periodic-tasks")
export class PeriodicTasksProcessor {
  private readonly logger = new Logger(PeriodicTasksProcessor.name);

  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    private readonly botsService: BotsService,
    private readonly sessionStorageService: SessionStorageService,
    private readonly periodicTaskService: PeriodicTaskService,
    @Inject(forwardRef(() => FlowExecutionService))
    private readonly flowExecutionService: FlowExecutionService,
  ) {}

  /**
   * Обработка периодического выполнения.
   *
   * Job data: { taskId, botId, flowId, nodeId, userId, chatId, sessionKey }
   *
   * Алгоритм:
   * 1. Проверяем статус задачи
   * 2. Загружаем flow и бота
   * 3. Находим дочерние узлы periodic_execution по edges
   * 4. Строим FlowContext с синтетическим message
   * 5. Выполняем дочерние узлы через FlowExecutionService
   * 6. Инкрементируем счётчик выполнений
   *
   * Потенциальные риски:
   * - Flow может быть деактивирован между срабатываниями
   * - Сессия пользователя может быть удалена
   * - Дочерние узлы могут выбросить ошибку
   */
  @Process("execute")
  async handlePeriodicExecution(job: Job): Promise<void> {
    const { taskId, botId, flowId, nodeId, userId, chatId } = job.data;

    this.logger.log(
      `=== PERIODIC TASK EXECUTION === taskId=${taskId}, bot=${botId}, node=${nodeId}`,
    );

    try {
      // Проверяем статус задачи
      let taskStatus = this.periodicTaskService.getTaskStatus(taskId);

      if (!taskStatus) {
        // Задача не найдена в in-memory Map (после рестарта сервера).
        // Пробуем восстановить метаданные из job.data.
        this.logger.log(
          `Задача ${taskId} не найдена в памяти, восстанавливаем из job.data...`,
        );

        const restored = this.periodicTaskService.restoreTask(job.data);
        if (!restored) {
          // Старый формат job.data без scheduleType — удаляем orphaned job
          this.logger.warn(
            `Не удалось восстановить задачу ${taskId}, удаляем orphaned job из Redis`,
          );
          await this.periodicTaskService.removeOrphanedJob(taskId);
          return;
        }

        taskStatus = this.periodicTaskService.getTaskStatus(taskId);
      }

      if (!taskStatus || taskStatus.status !== "running") {
        this.logger.log(
          `Задача ${taskId} не в статусе running (${taskStatus?.status || "unknown"}), пропускаем выполнение`,
        );
        return;
      }

      // Загружаем бота и проверяем его статус
      const bot = await this.botsService.findOne(botId, userId);
      if (!bot) {
        this.logger.error(`Бот ${botId} не найден, останавливаем задачу ${taskId}`);
        await this.periodicTaskService.stopTask(taskId);
        return;
      }

      if (bot.status !== BotStatus.ACTIVE) {
        this.logger.warn(
          `Бот ${botId} неактивен (статус: ${bot.status}), останавливаем задачу ${taskId}`,
        );
        await this.periodicTaskService.stopTask(taskId);
        return;
      }

      // Загружаем flow
      const flow = await this.botFlowRepository.findOne({
        where: { id: flowId, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });

      if (!flow) {
        this.logger.warn(
          `Flow ${flowId} не найден или не активен, останавливаем задачу ${taskId}`,
        );
        await this.periodicTaskService.stopTask(taskId);
        return;
      }

      // Находим периодический узел в flow
      const periodicNode = flow.nodes.find((n) => n.nodeId === nodeId);
      if (!periodicNode) {
        this.logger.warn(
          `Узел ${nodeId} не найден в flow ${flowId}, останавливаем задачу ${taskId}`,
        );
        await this.periodicTaskService.stopTask(taskId);
        return;
      }

      // Находим дочерние узлы (следующие по edges)
      const childEdges =
        flow.flowData?.edges?.filter((edge) => edge.source === nodeId) || [];

      if (childEdges.length === 0) {
        this.logger.warn(
          `Нет дочерних узлов у periodic_execution ${nodeId}, пропускаем`,
        );
        this.periodicTaskService.incrementExecutionCount(taskId);
        return;
      }

      // Получаем или создаем сессию
      let sessionData = await this.sessionStorageService.getSession(
        botId,
        userId,
      );

      if (!sessionData) {
        sessionData = {
          userId,
          chatId,
          botId,
          variables: {},
          lastActivity: new Date(),
        };
        await this.sessionStorageService.saveSession(sessionData);
      }

      // Выполняем дочерние узлы через FlowExecutionService
      // Создаем синтетический message для контекста
      const syntheticMessage = {
        from: {
          id: parseInt(userId) || 0,
          first_name: "PeriodicTask",
          is_bot: false,
        },
        chat: {
          id: parseInt(chatId) || 0,
          type: "private",
        },
        text: `__periodic_task_${taskId}__`,
        date: Math.floor(Date.now() / 1000),
      };

      // Выполняем ветку через публичный метод FlowExecutionService
      await this.flowExecutionService.executePeriodicBranch(
        bot,
        flow,
        periodicNode,
        sessionData,
        syntheticMessage,
      );

      // Инкрементируем счетчик
      this.periodicTaskService.incrementExecutionCount(taskId);

      this.logger.log(`Периодическая задача ${taskId} выполнена успешно`);
    } catch (error) {
      // Если пользователь заблокировал бота — останавливаем задачу, retry бессмысленны
      if (error instanceof TelegramBlockedError) {
        this.logger.warn(
          `Пользователь ${error.chatId} заблокировал бота, останавливаем задачу ${taskId}`,
        );
        await this.periodicTaskService.stopTask(taskId);
        return; // Не бросаем — BullMQ не должен делать retry
      }

      this.logger.error(
        `Ошибка выполнения периодической задачи ${taskId}:`,
        error,
      );
      throw error; // BullMQ выполнит retry по конфигурации
    }
  }
}
