import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";
import {
  PeriodicTaskService,
  PeriodicTaskConfig,
} from "../services/periodic-task.service";

/**
 * Обработчик узла Periodic Execution.
 *
 * При выполнении создает repeatable job в BullMQ через PeriodicTaskService.
 * Дочерняя ветка узлов выполняется процессором (PeriodicTasksProcessor),
 * а не напрямую этим обработчиком.
 *
 * Режимы работы:
 * - standalone: задача запускается при первом достижении узла (первое сообщение пользователя)
 * - triggered: задача запускается только когда узел достигнут через transition от родительского
 *
 * Сохраняет ID задачи в переменную сессии (taskIdVariable) для управления
 * через PeriodicControlNodeHandler.
 */
@Injectable()
export class PeriodicExecutionNodeHandler extends BaseNodeHandler {
  constructor(
    @InjectRepository(BotFlow)
    botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    @Inject(forwardRef(() => PeriodicTaskService))
    private readonly periodicTaskService: PeriodicTaskService,
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService,
      activityLogService,
    );
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "periodic_execution";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.periodicExecution) {
      this.logger.warn(
        "Данные periodicExecution не найдены в узле",
      );
      return;
    }

    const config = currentNode.data.periodicExecution;

    this.logger.log(
      `Periodic Execution: mode=${config.mode}, scheduleType=${config.scheduleType}`,
    );

    // В режиме triggered — запускаем только если достигнут через transition
    if (
      config.mode === "triggered" &&
      !context.reachedThroughTransition
    ) {
      this.logger.log(
        "Periodic Execution в triggered-режиме, но узел не достигнут через transition — пропускаем",
      );
      return;
    }

    // Проверяем, нет ли уже запущенной задачи для этого узла и пользователя
    const existingTaskId =
      config.taskIdVariable && session.variables[config.taskIdVariable];

    if (existingTaskId) {
      const existingStatus =
        this.periodicTaskService.getTaskStatus(existingTaskId);
      if (existingStatus && existingStatus.status === "running") {
        this.logger.log(
          `Задача ${existingTaskId} уже запущена для этого узла, пропускаем создание новой`,
        );
        // Не создаем новую — просто переходим дальше
        // (пользователь может управлять через Periodic Control)
        return;
      }
    }

    // Создаем конфигурацию задачи
    const taskConfig: PeriodicTaskConfig = {
      scheduleType: config.scheduleType,
      interval: config.interval,
      cronExpression: config.cronExpression,
      maxExecutions: config.maxExecutions,
      botId: session.botId,
      flowId: context.flow.id,
      nodeId: currentNode.nodeId,
      userId: session.userId,
      chatId: session.chatId,
      sessionKey: `${session.botId}-${session.userId}`,
    };

    try {
      // Создаем периодическую задачу
      const taskId = await this.periodicTaskService.createTask(taskConfig);

      this.logger.log(
        `Периодическая задача создана: ${taskId} для узла ${currentNode.nodeId}`,
      );

      // Сохраняем ID задачи в переменную сессии
      const variableName = config.taskIdVariable || "periodicTaskId";
      session.variables[variableName] = taskId;

      this.logger.log(
        `ID задачи сохранён в переменную '${variableName}': ${taskId}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка создания периодической задачи для узла ${currentNode.nodeId}:`,
        error,
      );
      await this.handleNodeError(context, error);
    }

    // Примечание: НЕ вызываем moveToNextNode —
    // дочерние узлы выполняются периодически через PeriodicTasksProcessor.
    // Если есть выход (edge) не к дочерним а к "далее по flow" —
    // это обрабатывается дочерними узлами.
  }
}
