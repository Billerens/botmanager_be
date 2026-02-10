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
import { PeriodicTaskService } from "../services/periodic-task.service";

/**
 * Обработчик узла Periodic Control.
 *
 * Управляет состоянием периодических задач: start, stop, pause, resume,
 * get_status, restart.
 *
 * Идентификация задачи — через переменную контекста (taskIdSource).
 *
 * Два выхода:
 * - "success" — операция выполнена успешно
 * - "error" — операция завершилась с ошибкой (задача не найдена, неверный статус и т.д.)
 */
@Injectable()
export class PeriodicControlNodeHandler extends BaseNodeHandler {
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
    return nodeType === "periodic_control";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.periodicControl) {
      this.logger.warn(
        "Данные periodicControl не найдены в узле",
      );
      return;
    }

    const controlData = currentNode.data.periodicControl;
    const { action, taskIdSource, saveStatusVariable } = controlData;

    // Получаем ID задачи из переменной контекста
    const taskId = this.substituteVariables(
      `{{${taskIdSource}}}`,
      context,
    );

    if (!taskId || taskId === `{{${taskIdSource}}}`) {
      this.logger.warn(
        `Переменная '${taskIdSource}' не найдена в контексте или пуста`,
      );
      await this.moveToNextNode(context, currentNode.nodeId, "error");
      return;
    }

    this.logger.log(
      `Periodic Control: action=${action}, taskId=${taskId}`,
    );

    let success = false;
    let statusResult: string | null = null;

    try {
      switch (action) {
        case "start": {
          // Start — возобновляет паузированную задачу
          success = await this.periodicTaskService.resumeTask(taskId);
          if (success) {
            statusResult = "running";
          }
          break;
        }

        case "stop": {
          success = await this.periodicTaskService.stopTask(taskId);
          if (success) {
            statusResult = "stopped";
          }
          break;
        }

        case "pause": {
          success = await this.periodicTaskService.pauseTask(taskId);
          if (success) {
            statusResult = "paused";
          }
          break;
        }

        case "resume": {
          success = await this.periodicTaskService.resumeTask(taskId);
          if (success) {
            statusResult = "running";
          }
          break;
        }

        case "get_status": {
          const status = this.periodicTaskService.getTaskStatus(taskId);
          if (status) {
            success = true;
            statusResult = status.status;

            // Дополнительно сохраняем детали в переменные
            session.variables[`${saveStatusVariable || "periodicStatus"}_count`] =
              status.executionCount.toString();
            if (status.lastExecutedAt) {
              session.variables[
                `${saveStatusVariable || "periodicStatus"}_lastExec`
              ] = status.lastExecutedAt.toISOString();
            }
          }
          break;
        }

        case "restart": {
          success = await this.periodicTaskService.restartTask(taskId);
          if (success) {
            statusResult = "running";
          }
          break;
        }

        default:
          this.logger.warn(`Неизвестное действие: ${action}`);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Ошибка выполнения действия '${action}' для задачи ${taskId}:`,
        error,
      );
      success = false;
    }

    // Сохраняем статус в переменную
    if (saveStatusVariable) {
      session.variables[saveStatusVariable] = statusResult || "error";
      this.logger.log(
        `Статус '${statusResult || "error"}' сохранён в переменную '${saveStatusVariable}'`,
      );
    }

    // Переходим к соответствующему выходу
    if (success) {
      this.logger.log(
        `Periodic Control: действие '${action}' выполнено успешно`,
      );
      await this.moveToNextNode(context, currentNode.nodeId, "success");
    } else {
      this.logger.warn(
        `Periodic Control: действие '${action}' завершилось с ошибкой`,
      );
      await this.moveToNextNode(context, currentNode.nodeId, "error");
    }
  }
}
