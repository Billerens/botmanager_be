import { Injectable, Logger, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Socket } from "socket.io";
import * as crypto from "crypto";

import { Bot } from "../../database/entities/bot.entity";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { BotCustomData } from "../../database/entities/bot-custom-data.entity";
import { SimulationSessionStore, SimulationSessionData } from "./simulation-session.store";
import { SimulationTransportService } from "./simulation-transport.service";
import { FlowContext } from "../bots/nodes/base-node-handler.interface";
import { NodeHandlerService } from "../bots/nodes/node-handler.service";
import { UserSession } from "../bots/flow-execution.service";
import { CustomLoggerService } from "../../common/logger.service";

/** Типы узлов, которые не симулируются */
const NON_SIMULATABLE_NODES = new Set([
  "payment",
  "webhook",
  "ai_single",
  "ai_chat",
  "broadcast",
]);

/** Заглушки для несимулируемых узлов */
const NODE_STUBS: Record<string, string> = {
  payment: "💳 Симуляция: оплата пропущена, переход далее",
  webhook: "🔗 Симуляция: вебхук пропущен",
  ai_single: "🤖 Симуляция: AI-ответ (заглушка)",
  ai_chat: "🤖 Симуляция: AI-чат (заглушка)",
  broadcast: "📢 Симуляция: рассылка пропущена",
};

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    @InjectRepository(BotCustomData)
    private readonly customDataRepository: Repository<BotCustomData>,
    private readonly sessionStore: SimulationSessionStore,
    private readonly transportService: SimulationTransportService,
    private readonly nodeHandlerService: NodeHandlerService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  /**
   * Запустить новую симуляцию
   */
  async startSimulation(
    socket: Socket,
    ownerId: string,
    botId: string,
    flowId?: string,
  ): Promise<{ simulationId: string }> {
    // Проверяем, что бот принадлежит пользователю (для гостей пропускаем проверку владения, 
    // так как она уже проверена в gateway через guestBotId)
    const isGuest = ownerId.startsWith("guest:");
    const bot = await this.botRepository.findOne({
      where: isGuest ? { id: botId } : { id: botId, ownerId },
    });

    if (!bot) {
      throw new ForbiddenException("Бот не найден или нет доступа");
    }

    // Находим flow
    let activeFlow: BotFlow;
    if (flowId) {
      activeFlow = await this.botFlowRepository.findOne({
        where: { id: flowId, botId },
        relations: ["nodes"],
      });
    } else {
      // Берём активный flow
      activeFlow = await this.botFlowRepository.findOne({
        where: { botId, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });
    }

    if (!activeFlow) {
      throw new NotFoundException("Flow не найден для данного бота");
    }

    // Копируем customData (custom_storage) в in-memory snapshot
    const customStorageSnapshot = new Map<string, any>();
    try {
      const customRecords = await this.customDataRepository.find({
        where: { botId },
      });
      for (const record of customRecords) {
        const key = `${record.collection}::${record.key}`;
        customStorageSnapshot.set(key, {
          ...record,
          data: JSON.parse(JSON.stringify(record.data)),
        });
      }
      this.logger.log(`Скопировано ${customRecords.length} записей customData для симуляции`);
    } catch (error) {
      this.logger.warn(`Ошибка копирования customData: ${error.message}`);
    }

    // Создаём сессию симуляции
    const simulationId = crypto.randomUUID();
    const session = this.sessionStore.create({
      simulationId,
      botId,
      flowId: activeFlow.id,
      ownerId,
      socketId: socket.id,
      variables: {},
      customStorageSnapshot,
      customDataSnapshot: new Map(),
    });

    this.logger.log(`Симуляция запущена: ${simulationId} (bot: ${botId}, flow: ${activeFlow.id})`);

    return { simulationId };
  }

  /**
   * Обработать сообщение «от пользователя» в симуляции
   */
  async processMessage(
    socket: Socket,
    simulationId: string,
    text: string,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "Сессия симуляции не найдена" });
      return;
    }

    this.sessionStore.touch(simulationId);

    // Получаем бота и flow
    const bot = await this.botRepository.findOne({ where: { id: session.botId } });
    if (!bot) {
      socket.emit("simulation:error", { message: "Бот не найден" });
      return;
    }

    const flow = await this.botFlowRepository.findOne({
      where: { id: session.flowId },
      relations: ["nodes"],
    });
    if (!flow) {
      socket.emit("simulation:error", { message: "Flow не найден" });
      return;
    }

    // Создаём синтетическое сообщение Telegram
    const syntheticMessage = this.createSyntheticMessage(text, session);

    // Создаём изолированную сессию пользователя
    const userSession: UserSession = {
      userId: `sim_${simulationId}`,
      chatId: `sim_chat_${simulationId}`,
      botId: session.botId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      lastActivity: new Date(),
    };

    // Настраиваем transport для WebSocket
    this.transportService.setSocket(socket);

    // Создаём FlowContext с подменённым transport
    const context: FlowContext = {
      bot,
      user: syntheticMessage.from,
      message: syntheticMessage,
      session: userSession,
      flow,
      reachedThroughTransition: false,
      transport: this.transportService,
    };

    try {
      await this.executeSimulationFlow(context, session, socket);
    } catch (error) {
      this.logger.error(`Ошибка симуляции ${simulationId}: ${error.message}`);
      socket.emit("simulation:error", { message: `Ошибка выполнения: ${error.message}` });
    } finally {
      this.transportService.clearSocket();
    }
  }

  /**
   * Обработать callback query (нажатие inline-кнопки)
   */
  async processCallback(
    socket: Socket,
    simulationId: string,
    callbackData: string,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "Сессия симуляции не найдена" });
      return;
    }

    this.sessionStore.touch(simulationId);

    const bot = await this.botRepository.findOne({ where: { id: session.botId } });
    const flow = await this.botFlowRepository.findOne({
      where: { id: session.flowId },
      relations: ["nodes"],
    });

    if (!bot || !flow) {
      socket.emit("simulation:error", { message: "Бот или flow не найден" });
      return;
    }

    // Создаём синтетический callback_query
    const syntheticMessage = this.createSyntheticMessage(callbackData, session);
    syntheticMessage.text = callbackData;

    const userSession: UserSession = {
      userId: `sim_${simulationId}`,
      chatId: `sim_chat_${simulationId}`,
      botId: session.botId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      lastActivity: new Date(),
    };

    this.transportService.setSocket(socket);

    const context: FlowContext = {
      bot,
      user: syntheticMessage.from,
      message: syntheticMessage,
      session: userSession,
      flow,
      reachedThroughTransition: false,
      transport: this.transportService,
    };

    try {
      await this.executeSimulationFlow(context, session, socket);
    } catch (error) {
      this.logger.error(`Ошибка callback симуляции ${simulationId}: ${error.message}`);
      socket.emit("simulation:error", { message: `Ошибка: ${error.message}` });
    } finally {
      this.transportService.clearSocket();
    }
  }

  /**
   * Отправить данные для endpoint-узла
   */
  async processEndpointData(
    socket: Socket,
    simulationId: string,
    nodeId: string,
    data: Record<string, any>,
  ): Promise<void> {
    const session = this.sessionStore.get(simulationId);
    if (!session) {
      socket.emit("simulation:error", { message: "Сессия не найдена" });
      return;
    }

    this.sessionStore.touch(simulationId);

    // Записываем данные в переменные сессии
    Object.assign(session.variables, data);

    // Если flow ожидает на этом endpoint-узле — продолжаем выполнение
    if (session.currentNodeId === nodeId) {
      const bot = await this.botRepository.findOne({ where: { id: session.botId } });
      const flow = await this.botFlowRepository.findOne({
        where: { id: session.flowId },
        relations: ["nodes"],
      });

      if (bot && flow) {
        const syntheticMessage = this.createSyntheticMessage("", session);
        const userSession: UserSession = {
          userId: `sim_${simulationId}`,
          chatId: `sim_chat_${simulationId}`,
          botId: session.botId,
          currentNodeId: session.currentNodeId,
          variables: session.variables,
          lastActivity: new Date(),
        };

        this.transportService.setSocket(socket);

        const context: FlowContext = {
          bot,
          user: syntheticMessage.from,
          message: syntheticMessage,
          session: userSession,
          flow,
          reachedThroughTransition: true,
          transport: this.transportService,
        };

        try {
          // Находим endpoint-узел и переходим к следующему
          const endpointNode = flow.nodes.find(n => n.nodeId === nodeId);
          if (endpointNode) {
            context.currentNode = endpointNode;
            await this.executeNodeWithSimulation(context, session, socket);
          }
        } finally {
          this.transportService.clearSocket();
        }
      }
    }
  }

  /**
   * Остановить симуляцию
   */
  stopSimulation(simulationId: string): void {
    this.sessionStore.delete(simulationId);
    this.logger.log(`Симуляция остановлена: ${simulationId}`);
  }

  /**
   * Обработка disconnect — очистка сессий по socketId
   */
  handleDisconnect(socketId: string): void {
    this.sessionStore.deleteBySocketId(socketId);
  }

  // ==================== Private ====================

  /**
   * Исполнение flow в режиме симуляции
   */
  private async executeSimulationFlow(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { flow, message } = context;

    // Определяем текущий узел
    if (message.text === "/start") {
      const startNode = flow.nodes.find(n => n.type === "start");
      if (startNode) {
        context.currentNode = startNode;
        context.session.currentNodeId = startNode.nodeId;
        session.currentNodeId = startNode.nodeId;
        await this.executeNodeWithSimulation(context, session, socket);
        return;
      }
    }

    // Если есть текущий узел — продолжаем выполнение от него
    if (session.currentNodeId) {
      const currentNode = flow.nodes.find(n => n.nodeId === session.currentNodeId);
      if (currentNode) {
        context.currentNode = currentNode;
        await this.executeNodeWithSimulation(context, session, socket);
        return;
      }
    }

    // Ищем new_message узлы (глобальные перехваты)
    const newMessageNodes = flow.nodes.filter(n => n.type === "new_message");
    for (const nmNode of newMessageNodes) {
      const newMessageData = nmNode.data?.newMessage;
      if (!newMessageData?.text) continue;

      const { text: filterText, caseSensitive } = newMessageData;
      const userText = caseSensitive ? message.text : (message.text || "").toLowerCase();
      const compareText = caseSensitive ? filterText : filterText.toLowerCase();

      if (userText === compareText) {
        context.currentNode = nmNode;
        context.session.currentNodeId = nmNode.nodeId;
        session.currentNodeId = nmNode.nodeId;
        await this.executeNodeWithSimulation(context, session, socket);
        return;
      }
    }

    this.logger.warn(`Симуляция: не найден подходящий узел для сообщения "${message.text}"`);
  }

  /**
   * Выполнить узел с учётом simulation-специфики
   */
  private async executeNodeWithSimulation(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { currentNode } = context;
    if (!currentNode) return;

    const nodeType = currentNode.type;

    // Проверяем, является ли узел несимулируемым
    if (NON_SIMULATABLE_NODES.has(nodeType)) {
      const stubMessage = NODE_STUBS[nodeType] || `⚠️ Узел "${nodeType}" не поддерживается в симуляции`;
      socket.emit("simulation:bot_message", { text: stubMessage });

      // Пропускаем узел — переходим к следующему
      const nextEdge = context.flow.flowData?.edges?.find(
        e => e.source === currentNode.nodeId,
      );
      if (nextEdge) {
        const nextNode = context.flow.nodes.find(n => n.nodeId === nextEdge.target);
        if (nextNode) {
          context.currentNode = nextNode;
          context.session.currentNodeId = nextNode.nodeId;
          session.currentNodeId = nextNode.nodeId;
          await this.executeNodeWithSimulation(context, session, socket);
        }
      }
      return;
    }

    // Специальная обработка periodic_execution
    if (nodeType === "periodic_execution") {
      await this.handlePeriodicSimulation(context, session, socket);
      return;
    }

    // Специальная обработка endpoint (ожидание данных)
    if (nodeType === "endpoint" && !context.reachedThroughTransition) {
      session.currentNodeId = currentNode.nodeId;
      context.session.currentNodeId = currentNode.nodeId;

      const endpointConfig = currentNode.data?.endpoint;
      socket.emit("simulation:endpoint_waiting", {
        nodeId: currentNode.nodeId,
        url: endpointConfig?.url || "unknown",
      });
      return;
    }

    // Стандартное выполнение через зарегистрированный handler
    const handler = this.nodeHandlerService.getHandler(nodeType);
    if (handler) {
      // Устанавливаем _currentContext для transport
      if ("_currentContext" in handler) {
        (handler as any)._currentContext = context;
      }

      await handler.execute(context);

      // Синхронизируем состояние обратно в SimulationSessionData
      session.currentNodeId = context.session.currentNodeId;
      session.variables = { ...context.session.variables };
    } else {
      this.logger.warn(`Симуляция: неизвестный тип узла "${nodeType}"`);
    }
  }

  /**
   * Симуляция periodic_execution через setTimeout
   */
  private async handlePeriodicSimulation(
    context: FlowContext,
    session: SimulationSessionData,
    socket: Socket,
  ): Promise<void> {
    const { currentNode } = context;
    const config = currentNode.data?.periodicExecution;
    if (!config) return;

    const intervalMs = this.getIntervalMs(config);
    const maxExecutions = config.maxExecutions || 5; // Лимитируем в симуляции
    const nodeId = currentNode.nodeId;

    // Очищаем предыдущий таймер если был
    const existingTimer = session.periodicTimers.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    session.periodicCounts.set(nodeId, 0);

    this.logger.log(`Симуляция periodic: interval=${intervalMs}ms, max=${maxExecutions}`);

    // Запускаем периодическое выполнение
    const executePeriodicTick = async () => {
      const count = (session.periodicCounts.get(nodeId) || 0) + 1;
      session.periodicCounts.set(nodeId, count);

      if (count > maxExecutions) {
        session.periodicTimers.delete(nodeId);
        return;
      }

      socket.emit("simulation:periodic_tick", { nodeId, executionCount: count });

      // Выполняем дочерние узлы
      const childEdges = context.flow.flowData?.edges?.filter(
        e => e.source === nodeId,
      ) || [];

      for (const edge of childEdges) {
        const childNode = context.flow.nodes.find(n => n.nodeId === edge.target);
        if (childNode) {
          const childContext: FlowContext = {
            ...context,
            currentNode: childNode,
            reachedThroughTransition: true,
          };
          childContext.session.currentNodeId = childNode.nodeId;

          this.transportService.setSocket(socket);
          try {
            await this.executeNodeWithSimulation(childContext, session, socket);
          } finally {
            this.transportService.clearSocket();
          }
        }
      }

      // Планируем следующий тик
      if (count < maxExecutions) {
        const timer = setTimeout(executePeriodicTick, intervalMs);
        session.periodicTimers.set(nodeId, timer);
      }
    };

    // Первый тик через интервал
    const timer = setTimeout(executePeriodicTick, Math.min(intervalMs, 10000)); // Макс 10 сек в симуляции
    session.periodicTimers.set(nodeId, timer);
  }

  /**
   * Получить интервал в миллисекундах из конфигурации periodic
   */
  private getIntervalMs(config: any): number {
    if (config.scheduleType === "interval") {
      const interval = config.interval || {};
      const seconds =
        (interval.days || 0) * 86400 +
        (interval.hours || 0) * 3600 +
        (interval.minutes || 0) * 60 +
        (interval.seconds || 0);
      return Math.max(seconds * 1000, 5000); // Минимум 5 сек
    }
    // Для cron — используем фиксированный интервал в симуляции
    return 10000; // 10 секунд
  }

  /**
   * Создать синтетическое Telegram-сообщение для симуляции
   */
  private createSyntheticMessage(text: string, session: SimulationSessionData): any {
    return {
      message_id: Date.now(),
      from: {
        id: parseInt(session.simulationId.replace(/\D/g, "").substring(0, 9)) || 999999,
        is_bot: false,
        first_name: "Симулятор",
        last_name: "Пользователь",
        username: "sim_user",
        language_code: "ru",
      },
      chat: {
        id: parseInt(session.simulationId.replace(/\D/g, "").substring(0, 9)) || 999999,
        type: "private" as const,
        first_name: "Симулятор",
        last_name: "Пользователь",
      },
      date: Math.floor(Date.now() / 1000),
      text,
    };
  }
}
