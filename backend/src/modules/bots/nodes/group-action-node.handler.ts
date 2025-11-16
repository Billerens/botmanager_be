import { Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Repository } from "typeorm";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowContext } from "./base-node-handler.interface";
import { GroupSessionService } from "../group-session.service";
import { SessionStorageService } from "../session-storage.service";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { RedisService } from "../../websocket/services/redis.service";
import { ConditionOperator } from "../../../database/entities/bot-flow-node.entity";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class GroupActionNodeHandler extends BaseNodeHandler {
  constructor(
    private readonly groupSessionService: GroupSessionService,
    private readonly sessionStorageService: SessionStorageService,
    @InjectRepository(BotFlow) botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    private readonly redisService: RedisService,
    @InjectQueue("group-actions") private readonly groupActionsQueue: Queue
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService,
      activityLogService
    );
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "group_action";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполнение GROUP_ACTION узла ${currentNode.nodeId} для пользователя ${session.userId}`
    );

    try {
      const { groupAction } = currentNode.data;

      if (!groupAction) {
        throw new Error("Отсутствуют данные groupAction в узле");
      }

      // Проверяем, что пользователь в группе
      if (!session.lobbyData?.groupSessionId) {
        throw new Error("Пользователь не состоит в группе");
      }

      const groupId = session.lobbyData.groupSessionId;
      const group = await this.groupSessionService.findById(groupId);

      if (!group) {
        throw new Error("Группа не найдена");
      }

      // Выполняем действие в зависимости от типа
      switch (groupAction.actionType) {
        case "broadcast":
          await this.handleBroadcast(context, group, groupAction.broadcast);
          break;

        case "collect":
          await this.handleCollect(context, group, groupAction.collect);
          break;

        case "aggregate":
          await this.handleAggregate(context, group, groupAction.aggregate);
          break;

        case "condition":
          await this.handleCondition(context, group, groupAction.condition);
          return; // condition сам управляет переходом

        default:
          throw new Error(
            `Неизвестный тип действия: ${groupAction.actionType}`
          );
      }

      // Переходим к следующему узлу (кроме condition)
      await this.moveToNextNode(context, context.currentNode.nodeId);
    } catch (error) {
      this.logger.error(`Ошибка в GROUP_ACTION узле:`, error);
      await this.handleNodeError(context, error);
    }
  }

  /**
   * Broadcast: отправить сообщение всем участникам группы
   */
  private async handleBroadcast(
    context: FlowContext,
    group: any,
    broadcastConfig: any
  ): Promise<void> {
    if (!broadcastConfig) {
      throw new Error("Отсутствует конфигурация broadcast");
    }

    this.logger.log(`Выполнение broadcast для группы ${group.id}`);

    // Заменяем переменные в сообщении
    const message = this.replaceVariables(
      broadcastConfig.message,
      context.session.variables,
      group.sharedVariables
    );

    // Получаем участников
    const participantIds = await this.groupSessionService.getParticipantIds(
      group.id
    );

    // Добавляем задачу в очередь для асинхронной обработки
    await this.groupActionsQueue.add("broadcast", {
      groupId: group.id,
      botId: context.bot.id,
      botToken: context.bot.token,
      message,
      buttons: broadcastConfig.buttons,
      excludeUserId: broadcastConfig.excludeSelf
        ? context.session.userId
        : null,
      participantIds,
    });

    this.logger.log(
      `Broadcast задача добавлена в очередь для ${participantIds.length} участников`
    );
  }

  /**
   * Collect: собрать данные от всех участников
   */
  private async handleCollect(
    context: FlowContext,
    group: any,
    collectConfig: any
  ): Promise<void> {
    if (!collectConfig) {
      throw new Error("Отсутствует конфигурация collect");
    }

    const { variableName, aggregateAs, timeout, waitForAll } = collectConfig;
    const nodeId = context.currentNode!.nodeId;
    const actionKey = `group:${group.id}:action:${nodeId}`;

    this.logger.log(
      `Выполнение collect для группы ${group.id}, переменная: ${variableName}`
    );

    // Сохраняем ответ текущего пользователя
    const userValue = context.session.variables[variableName];
    if (userValue !== undefined) {
      await this.redisService.hset(
        `${actionKey}:responses`,
        context.session.userId,
        JSON.stringify(userValue)
      );
      await this.redisService.sadd(
        `${actionKey}:completed`,
        context.session.userId
      );

      this.logger.log(
        `Сохранен ответ пользователя ${context.session.userId}: ${userValue}`
      );
    }

    // Проверяем, все ли ответили
    const completedUsers = await this.redisService.smembers(
      `${actionKey}:completed`
    );
    const participantIds = await this.groupSessionService.getParticipantIds(
      group.id
    );

    this.logger.log(
      `Ответили: ${completedUsers.length}/${participantIds.length}`
    );

    const shouldWait = waitForAll !== false; // по умолчанию true

    if (shouldWait && completedUsers.length < participantIds.length) {
      // Ждем остальных
      this.logger.log("Ожидание ответов от остальных участников...");

      // Устанавливаем таймаут если указан
      if (timeout) {
        await this.redisService.expire(`${actionKey}:responses`, timeout);
        await this.redisService.expire(`${actionKey}:completed`, timeout);
      }

      // Не переходим к следующему узлу, ждем
      return;
    }

    // Собираем все ответы
    const responses = await this.redisService.hgetall(`${actionKey}:responses`);
    const collectedData: any[] = [];
    const lateUsers: string[] = [];

    for (const userId of participantIds) {
      if (responses[userId]) {
        try {
          collectedData.push(JSON.parse(responses[userId]));
        } catch (e) {
          collectedData.push(responses[userId]);
        }
      } else {
        lateUsers.push(userId);
      }
    }

    this.logger.log(
      `Собрано ответов: ${collectedData.length}, опоздавших: ${lateUsers.length}`
    );

    // Сохраняем результаты в общие переменные группы
    await this.groupSessionService.updateSharedVariables(group.id, {
      [aggregateAs]: collectedData,
      [`${aggregateAs}_late_users`]: lateUsers,
    });

    // Очищаем временные данные
    await this.redisService.del(`${actionKey}:responses`);
    await this.redisService.del(`${actionKey}:completed`);

    this.logger.log("Collect завершен, данные сохранены");
  }

  /**
   * Aggregate: агрегировать данные
   */
  private async handleAggregate(
    context: FlowContext,
    group: any,
    aggregateConfig: any
  ): Promise<void> {
    if (!aggregateConfig) {
      throw new Error("Отсутствует конфигурация aggregate");
    }

    const { operation, sourceVariable, targetVariable, scope } =
      aggregateConfig;

    this.logger.log(`Выполнение aggregate ${operation} для группы ${group.id}`);

    // Получаем исходные данные
    let sourceData: any[];

    if (scope === "group") {
      // Берем из общих переменных группы
      sourceData = group.sharedVariables[sourceVariable];
    } else {
      // Собираем из индивидуальных переменных всех участников
      const sessions = await this.groupSessionService.getParticipantSessions(
        group.id
      );
      sourceData = sessions
        .map((s) => s.variables[sourceVariable])
        .filter((v) => v !== undefined);
    }

    if (!Array.isArray(sourceData)) {
      throw new Error(`Исходные данные ${sourceVariable} не являются массивом`);
    }

    // Выполняем агрегацию
    let result: any;

    switch (operation) {
      case "sum":
        result = sourceData.reduce((sum, val) => sum + (Number(val) || 0), 0);
        break;

      case "avg":
        const sum = sourceData.reduce((s, val) => s + (Number(val) || 0), 0);
        result = sourceData.length > 0 ? sum / sourceData.length : 0;
        break;

      case "min":
        result = Math.min(...sourceData.map((v) => Number(v) || 0));
        break;

      case "max":
        result = Math.max(...sourceData.map((v) => Number(v) || 0));
        break;

      case "count":
        result = sourceData.length;
        break;

      case "list":
        result = sourceData;
        break;

      default:
        throw new Error(`Неизвестная операция агрегации: ${operation}`);
    }

    this.logger.log(`Результат агрегации ${operation}: ${result}`);

    // Сохраняем результат
    if (scope === "group") {
      await this.groupSessionService.updateSharedVariables(group.id, {
        [targetVariable]: result,
      });
    } else {
      // Сохраняем в индивидуальные переменные текущего пользователя
      context.session.variables[targetVariable] = result;
    }
  }

  /**
   * Condition: проверка условий группы
   */
  private async handleCondition(
    context: FlowContext,
    group: any,
    conditionConfig: any
  ): Promise<void> {
    if (!conditionConfig) {
      throw new Error("Отсутствует конфигурация condition");
    }

    const { field, operator, value } = conditionConfig;

    this.logger.log(`Проверка условия группы: ${field} ${operator} ${value}`);

    // Получаем значение поля
    let fieldValue: any;

    if (field === "participantCount") {
      fieldValue = group.participantCount;
    } else if (field.startsWith("sharedVariables.")) {
      const varName = field.substring("sharedVariables.".length);
      fieldValue = group.sharedVariables[varName];
    } else {
      fieldValue = group[field];
    }

    // Проверяем условие
    const result = this.evaluateCondition(fieldValue, operator, value);

    this.logger.log(`Результат условия: ${result}`);

    // Переходим к соответствующему узлу
    const edges = context.flow.flowData?.edges || [];
    const currentNodeId = context.currentNode!.nodeId;

    const trueEdge = edges.find(
      (e) =>
        e.source === currentNodeId &&
        (e.sourceHandle === "true" || e.label === "true")
    );

    const falseEdge = edges.find(
      (e) =>
        e.source === currentNodeId &&
        (e.sourceHandle === "false" || e.label === "false")
    );

    const targetEdge = result ? trueEdge : falseEdge;

    if (targetEdge) {
      const nextNode = context.flow.nodes.find(
        (n) => n.nodeId === targetEdge.target
      );
      if (nextNode) {
        context.currentNode = nextNode;
        context.session.currentNodeId = nextNode.nodeId;
        await this.executeNodeCallback(context);
      }
    }
  }

  private evaluateCondition(
    fieldValue: any,
    operator: ConditionOperator,
    value: any
  ): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return fieldValue == value;
      case ConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(value);
      case ConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(value);
      case ConditionOperator.IS_EMPTY:
        return !fieldValue || fieldValue === "";
      case ConditionOperator.IS_NOT_EMPTY:
        return !!fieldValue && fieldValue !== "";
      default:
        return false;
    }
  }

  private replaceVariables(
    text: string,
    userVariables: Record<string, any>,
    groupVariables: Record<string, any>
  ): string {
    let result = text;

    // Заменяем переменные пользователя {var}
    result = result.replace(/\{(\w+)\}/g, (match, varName) => {
      return userVariables[varName] || groupVariables[varName] || match;
    });

    return result;
  }
}
