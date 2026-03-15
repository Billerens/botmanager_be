import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import { Shop } from "../../database/entities/shop.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import {
  BotFlowNode,
  NodeType,
} from "../../database/entities/bot-flow-node.entity";
import { TelegramService, TelegramBlockedError } from "../telegram/telegram.service";
import { BotsService } from "./bots.service";
import {
  SessionStorageService,
  UserSessionData,
} from "./session-storage.service";
import { CustomLoggerService } from "../../common/logger.service";
import { MessagesService } from "../messages/messages.service";
import {
  MessageType,
  MessageContentType,
} from "../../database/entities/message.entity";
import {
  NodeHandlerService,
  FlowContext,
  INodeHandler,
  StartNodeHandler,
  MessageNodeHandler,
  KeyboardNodeHandler,
  ConditionNodeHandler,
  EndNodeHandler,
  FormNodeHandler,
  DelayNodeHandler,
  VariableNodeHandler,
  FileNodeHandler,
  RandomNodeHandler,
  WebhookNodeHandler,
  IntegrationNodeHandler,
  NewMessageNodeHandler,
  EndpointNodeHandler,
  BroadcastNodeHandler,
  DatabaseNodeHandler,
  LocationNodeHandler,
  CalculatorNodeHandler,
  TransformNodeHandler,
  GroupCreateNodeHandler,
  GroupJoinNodeHandler,
  GroupActionNodeHandler,
  GroupLeaveNodeHandler,
  AiSingleNodeHandler,
  AiChatNodeHandler,
  PaymentNodeHandler,
  PeriodicExecutionNodeHandler,
  PeriodicControlNodeHandler,
  PortalInNodeHandler,
  PortalOutNodeHandler,
} from "./nodes";
import { GroupSessionService } from "./group-session.service";
import { CustomPagesBotService } from "../custom-pages/services/custom-pages-bot.service";
import { PeriodicTaskService } from "./services/periodic-task.service";

export interface UserSession {
  userId: string;
  chatId: string;
  botId: string;
  currentNodeId?: string;
  variables: Record<string, any>;
  lastActivity: Date;
  locationRequest?: {
    nodeId: string;
    timestamp: Date;
    timeout: number;
  };
  lobbyData?: {
    lobbyId?: string;
    groupSessionId?: string;
    role?: string;
    joinedAt?: Date;
    participantVariables?: Record<string, any>;
  };
}

export interface EndpointData {
  data: Record<string, any>;
  receivedAt: Date;
  requestCount: number;
}

@Injectable()
export class FlowExecutionService implements OnModuleInit {
  // Глобальное хранилище данных эндпоинтов: ключ = "botId-nodeId"
  private endpointDataStore = new Map<string, EndpointData>();

  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly sessionStorageService: SessionStorageService,
    private readonly logger: CustomLoggerService,
    private readonly messagesService: MessagesService,
    private readonly nodeHandlerService: NodeHandlerService,
    private readonly groupSessionService: GroupSessionService,
    private readonly customPagesBotService: CustomPagesBotService,
    // Node handlers
    private readonly startNodeHandler: StartNodeHandler,
    private readonly messageNodeHandler: MessageNodeHandler,
    private readonly keyboardNodeHandler: KeyboardNodeHandler,
    private readonly conditionNodeHandler: ConditionNodeHandler,
    private readonly endNodeHandler: EndNodeHandler,
    private readonly formNodeHandler: FormNodeHandler,
    private readonly delayNodeHandler: DelayNodeHandler,
    private readonly variableNodeHandler: VariableNodeHandler,
    private readonly fileNodeHandler: FileNodeHandler,
    private readonly randomNodeHandler: RandomNodeHandler,
    private readonly webhookNodeHandler: WebhookNodeHandler,
    private readonly integrationNodeHandler: IntegrationNodeHandler,
    private readonly newMessageNodeHandler: NewMessageNodeHandler,
    private readonly endpointNodeHandler: EndpointNodeHandler,
    private readonly broadcastNodeHandler: BroadcastNodeHandler,
    private readonly databaseNodeHandler: DatabaseNodeHandler,
    private readonly locationNodeHandler: LocationNodeHandler,
    private readonly calculatorNodeHandler: CalculatorNodeHandler,
    private readonly transformNodeHandler: TransformNodeHandler,
    // Group handlers
    private readonly groupCreateNodeHandler: GroupCreateNodeHandler,
    private readonly groupJoinNodeHandler: GroupJoinNodeHandler,
    private readonly groupActionNodeHandler: GroupActionNodeHandler,
    private readonly groupLeaveNodeHandler: GroupLeaveNodeHandler,
    // AI handlers
    private readonly aiSingleNodeHandler: AiSingleNodeHandler,
    private readonly aiChatNodeHandler: AiChatNodeHandler,
    // Payment handler
    private readonly paymentNodeHandler: PaymentNodeHandler,
    // Periodic handlers
    private readonly periodicExecutionNodeHandler: PeriodicExecutionNodeHandler,
    private readonly periodicControlNodeHandler: PeriodicControlNodeHandler,
    // Portals
    private readonly portalInNodeHandler: PortalInNodeHandler,
    private readonly portalOutNodeHandler: PortalOutNodeHandler,
    private readonly periodicTaskService: PeriodicTaskService,
  ) {
    // Регистрируем все обработчики
    this.registerNodeHandlers();
  }

  async onModuleInit() {
    // Запуск периодической очистки сессий (каждые 24 часа)
    setInterval(
      () => {
        this.cleanupSessions();
      },
      24 * 60 * 60 * 1000,
    );
  }

  private registerNodeHandlers(): void {
    this.nodeHandlerService.registerHandler("start", this.startNodeHandler);
    this.nodeHandlerService.registerHandler("message", this.messageNodeHandler);
    this.nodeHandlerService.registerHandler(
      "keyboard",
      this.keyboardNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "condition",
      this.conditionNodeHandler,
    );
    this.nodeHandlerService.registerHandler("end", this.endNodeHandler);
    this.nodeHandlerService.registerHandler("form", this.formNodeHandler);
    this.nodeHandlerService.registerHandler("delay", this.delayNodeHandler);
    this.nodeHandlerService.registerHandler(
      "variable",
      this.variableNodeHandler,
    );
    this.nodeHandlerService.registerHandler("file", this.fileNodeHandler);
    this.nodeHandlerService.registerHandler("random", this.randomNodeHandler);
    this.nodeHandlerService.registerHandler("webhook", this.webhookNodeHandler);
    this.nodeHandlerService.registerHandler(
      "integration",
      this.integrationNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "new_message",
      this.newMessageNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "endpoint",
      this.endpointNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "broadcast",
      this.broadcastNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "database",
      this.databaseNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "location",
      this.locationNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "calculator",
      this.calculatorNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "transform",
      this.transformNodeHandler,
    );
    // Group handlers
    this.nodeHandlerService.registerHandler(
      "group_create",
      this.groupCreateNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "group_join",
      this.groupJoinNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "group_action",
      this.groupActionNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "group_leave",
      this.groupLeaveNodeHandler,
    );
    // AI handlers
    this.nodeHandlerService.registerHandler(
      "ai_single",
      this.aiSingleNodeHandler,
    );
    this.nodeHandlerService.registerHandler("ai_chat", this.aiChatNodeHandler);

    // Payment handler
    this.nodeHandlerService.registerHandler("payment", this.paymentNodeHandler);

    // Periodic handlers
    this.nodeHandlerService.registerHandler(
      "periodic_execution",
      this.periodicExecutionNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "periodic_control",
      this.periodicControlNodeHandler,
    );

    // Portals
    this.nodeHandlerService.registerHandler(
      "portal_in",
      this.portalInNodeHandler,
    );
    this.nodeHandlerService.registerHandler(
      "portal_out",
      this.portalOutNodeHandler,
    );

    // Устанавливаем callback для всех обработчиков
    const handlers = [
      this.startNodeHandler,
      this.messageNodeHandler,
      this.keyboardNodeHandler,
      this.conditionNodeHandler,
      this.endNodeHandler,
      this.formNodeHandler,
      this.delayNodeHandler,
      this.variableNodeHandler,
      this.fileNodeHandler,
      this.randomNodeHandler,
      this.webhookNodeHandler,
      this.integrationNodeHandler,
      this.newMessageNodeHandler,
      this.endpointNodeHandler,
      this.broadcastNodeHandler,
      this.databaseNodeHandler,
      this.locationNodeHandler,
      this.calculatorNodeHandler,
      this.transformNodeHandler,
      this.groupCreateNodeHandler,
      this.groupJoinNodeHandler,
      this.groupActionNodeHandler,
      this.groupLeaveNodeHandler,
      this.aiSingleNodeHandler,
      this.aiChatNodeHandler,
      this.paymentNodeHandler,
      this.periodicExecutionNodeHandler,
      this.periodicControlNodeHandler,
      this.portalInNodeHandler,
      this.portalOutNodeHandler,
    ];

    handlers.forEach((handler) => {
      handler.setExecuteNodeCallback(this.executeNode.bind(this));
    });
  }

  async processMessage(bot: any, message: any): Promise<void> {
    try {
      const userId = message.from.id.toString();
      const chatId = message.chat.id.toString();
      const sessionKey = `${bot.id}-${userId}`;

      this.logger.log(`=== ОБРАБОТКА СООБЩЕНИЯ ===`);
      this.logger.log(`Bot ID: ${bot.id}`);
      this.logger.log(`User ID: ${userId}`);
      this.logger.log(`Chat ID: ${chatId}`);
      this.logger.log(`Message text: "${message.text}"`);
      this.logger.log(`Message type: ${message.type || "text"}`);
      this.logger.log(`Session key: ${sessionKey}`);

      // Получаем или создаем сессию пользователя
      let sessionData = await this.sessionStorageService.getSession(
        bot.id,
        userId,
      );
      let session: UserSession;

      if (!sessionData) {
        this.logger.log(`Создаем новую сессию для пользователя ${userId}`);
        sessionData = {
          userId,
          chatId,
          botId: bot.id,
          variables: {},
          lastActivity: new Date(),
        };
        session = {
          userId,
          chatId,
          botId: bot.id,
          variables: {},
          lastActivity: new Date(),
        };
        await this.sessionStorageService.saveSession(sessionData);
      } else {
        this.logger.log(
          `Найдена существующая сессия для пользователя ${userId}`,
        );
        this.logger.log(
          `Текущий узел: ${sessionData.currentNodeId || "не установлен"}`,
        );
        session = {
          userId: sessionData.userId,
          chatId: sessionData.chatId,
          botId: sessionData.botId,
          currentNodeId: sessionData.currentNodeId,
          variables: sessionData.variables,
          lastActivity: sessionData.lastActivity,
          locationRequest: sessionData.locationRequest,
        };
      }

      // Находим активный flow для бота
      this.logger.log(`Ищем активный flow для бота ${bot.id}`);
      const activeFlow = await this.botFlowRepository.findOne({
        where: { botId: bot.id, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });

      if (!activeFlow) {
        this.logger.warn(`Нет активного flow для бота ${bot.id}`);
        return;
      }

      this.logger.log(`Найден активный flow: ${activeFlow.id}`);
      this.logger.log(`Flow содержит ${activeFlow.nodes.length} узлов:`);
      activeFlow.nodes.forEach((node, index) => {
        this.logger.log(
          `  ${index + 1}. ID: ${node.nodeId}, Type: "${node.type}", Name: "${node.name}"`,
        );
      });

      // Проверяем, находится ли пользователь в группе
      let groupSession = null;
      if (session.lobbyData?.groupSessionId) {
        groupSession = await this.groupSessionService.findById(
          session.lobbyData.groupSessionId,
        );
      }

      // Создаем контекст выполнения
      const context: FlowContext = {
        bot,
        user: message.from,
        message,
        session,
        flow: activeFlow,
        reachedThroughTransition: false, // По умолчанию узел не достигнут через переход
        groupSession: groupSession || undefined,
        isGroupContext: !!groupSession,
        executeNodeCallback: this.executeNode.bind(this),
      };

      // Определяем текущий узел
      this.logger.log(`Определяем текущий узел...`);

      // 1. Сначала проверяем команды (всегда высший приоритет)
      if (message.text?.startsWith("/")) {
        const resolved = await this.resolveInitialNodeByMessage(
          bot,
          message,
          activeFlow,
          session,
        );

        if (resolved?.returnEarly) {
          return;
        }

        if (resolved?.node) {
          this.logger.log(
            `Глобальная команда перенаправила на узел: ${resolved.node.nodeId}`,
          );
          context.currentNode = resolved.node;
          session.currentNodeId = resolved.node.nodeId;
          await this.executeNode(context);
          return;
        }
      }

      // 2. Если есть текущий узел, выполняем его первым
      if (session.currentNodeId) {
        this.logger.log(`Продолжаем с текущего узла: ${session.currentNodeId}`);
        
        context.currentNode = activeFlow.nodes.find(
          (node) => node.nodeId === session.currentNodeId,
        );

        if (context.currentNode) {
          this.logger.log(
            `Найден текущий узел: ${context.currentNode.nodeId}, тип: "${context.currentNode.type}"`,
          );

          // Узел "end" означает завершение ветки — сбрасываем и ищем по тексту ниже
          if (context.currentNode.type === "end") {
            this.logger.log(
              `Текущий узел — end, сбрасываем и ищем глобальный перехват`,
            );
            session.currentNodeId = undefined;
            context.currentNode = undefined;
          } else {
            // Выполняем узел
            await this.executeNode(context);

            // Если ввод был поглощен (нажата кнопка или валидный ввод в форме), выходим
            if (context.inputConsumed) {
              this.logger.log(`Ввод поглощен текущим узлом, завершаем обработку`);
              return;
            }
            
            this.logger.log(`Ввод НЕ поглощен текущим узлом, ищем глобальный перехват`);
          }
        } else {
          this.logger.warn(
            `Текущий узел ${session.currentNodeId} не найден в flow. Сбрасываем.`,
          );
          session.currentNodeId = undefined;
        }
      }

      // 3. Проверяем глобальные перехваты (ключевые слова)
      // Сюда попадаем если:
      // - Текущего узла не было
      // - Текущий узел был "end"
      // - Текущий узел НЕ поглотил ввод (например, в меню ввели текст, не соответствующий кнопкам)
      const resolvedKeyword = await this.resolveInitialNodeByMessage(
        bot,
        message,
        activeFlow,
        session,
      );

      if (resolvedKeyword?.returnEarly) {
        return;
      }

      if (resolvedKeyword?.node) {
        this.logger.log(
          `Глобальный перехват по ключевому слову: ${resolvedKeyword.node.nodeId}`,
        );
        context.currentNode = resolvedKeyword.node;
        session.currentNodeId = resolvedKeyword.node.nodeId;
        await this.executeNode(context);
        return;
      }

      // 4. Если ничего не сработало и это первое сообщение - активируем периодические задачи
      if (!session.variables.lastMessageAt) {
        await this.activateStandalonePeriodicNodes(activeFlow, session, context);
      }
      
      session.variables.lastMessageAt = new Date().toISOString();
    } catch (error) {
      // Пользователь заблокировал бота — логируем и тихо завершаем,
      // не пробрасываем ошибку (webhook всё равно не сможет отправить ответ)
      if (error instanceof TelegramBlockedError) {
        this.logger.warn(
          `Пользователь ${error.chatId} заблокировал бота ${bot.id}, flow прерван`,
        );
        return;
      }

      this.logger.error("Ошибка выполнения flow:", error);
      throw error;
    }
  }

  /**
   * Активирует все standalone periodic_execution узлы в flow.
   *
   * Вызывается при каждом сообщении пользователя. Для каждого
   * periodic_execution узла с mode="standalone" проверяет,
   * не создана ли уже задача (по taskIdVariable в сессии),
   * и если нет — создаёт repeatable job через PeriodicTaskService.
   *
   * O(n) — по количеству узлов в flow.
   */
  private async activateStandalonePeriodicNodes(
    flow: BotFlow,
    session: UserSession,
    context: FlowContext,
  ): Promise<void> {
    const periodicNodes = flow.nodes.filter(
      (node) =>
        node.type === "periodic_execution" &&
        node.data?.periodicExecution?.mode === "standalone",
    );

    if (periodicNodes.length === 0) return;

    this.logger.log(
      `Найдено ${periodicNodes.length} standalone periodic_execution узлов`,
    );

    for (const periodicNode of periodicNodes) {
      const config = periodicNode.data.periodicExecution;
      if (!config) continue;

      const variableName = config.taskIdVariable || "periodicTaskId";

      // Проверяем, не создана ли уже задача для этого узла
      const existingTaskId = session.variables[variableName];
      if (existingTaskId) {
        const existingStatus =
          this.periodicTaskService.getTaskStatus(existingTaskId);
        if (
          existingStatus &&
          (existingStatus.status === "running" ||
            existingStatus.status === "paused")
        ) {
          this.logger.log(
            `Standalone задача для узла ${periodicNode.nodeId} уже активна (${existingTaskId}), пропускаем`,
          );
          continue;
        }
      }

      try {
        const taskId = await this.periodicTaskService.createTask({
          scheduleType: config.scheduleType,
          interval: config.interval,
          cronExpression: config.cronExpression,
          maxExecutions: config.maxExecutions,
          botId: session.botId,
          flowId: flow.id,
          nodeId: periodicNode.nodeId,
          userId: session.userId,
          chatId: session.chatId,
          sessionKey: `${session.botId}-${session.userId}`,
        });

        session.variables[variableName] = taskId;

        this.logger.log(
          `Standalone periodic задача создана: ${taskId} для узла ${periodicNode.nodeId}, сохранена в '${variableName}'`,
        );
      } catch (error) {
        this.logger.error(
          `Ошибка активации standalone periodic узла ${periodicNode.nodeId}:`,
          error,
        );
      }
    }

    // Сохраняем обновлённую сессию с taskId
    const sessionData: UserSessionData = {
      userId: session.userId,
      chatId: session.chatId,
      botId: session.botId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      lastActivity: session.lastActivity,
      locationRequest: session.locationRequest,
    };
    await this.sessionStorageService.saveSession(sessionData);
  }

  /**
   * Публичный метод для выполнения дочерней ветки periodic_execution узла.
   * Вызывается из PeriodicTasksProcessor при срабатывании repeatable job.
   *
   * Находит дочерние узлы по edges и выполняет их последовательно.
   */
  async executePeriodicBranch(
    bot: any,
    flow: BotFlow,
    periodicNode: BotFlowNode,
    sessionData: any,
    syntheticMessage: any,
  ): Promise<void> {
    // Сохраняем оригинальный currentNodeId основного flow —
    // периодическая ветка не должна его менять
    const originalCurrentNodeId = sessionData.currentNodeId;

    const session: UserSession = {
      userId: sessionData.userId,
      chatId: sessionData.chatId,
      botId: sessionData.botId,
      currentNodeId: undefined, // Изолируем от основного flow
      variables: { ...(sessionData.variables || {}) }, // Копия для безопасной мутации
      lastActivity: new Date(),
      locationRequest: sessionData.locationRequest,
    };

    const context: FlowContext = {
      bot,
      user: syntheticMessage.from,
      message: syntheticMessage,
      session,
      flow,
      reachedThroughTransition: true,
      executeNodeCallback: this.executeNode.bind(this),
    };

    // Находим дочерние узлы по edges
    const childEdges =
      flow.flowData?.edges?.filter(
        (edge) => edge.source === periodicNode.nodeId,
      ) || [];

    this.logger.log(
      `Выполняем ${childEdges.length} дочерних веток periodic_execution ${periodicNode.nodeId}`,
    );

    for (const edge of childEdges) {
      const childNode = flow.nodes.find((n) => n.nodeId === edge.target);
      if (childNode) {
        context.currentNode = childNode;
        session.currentNodeId = childNode.nodeId;
        await this.executeNode(context);
      }
    }

    // Сохраняем сессию: восстанавливаем оригинальный currentNodeId основного flow,
    // но сохраняем обновлённые переменные (counter и т.д.)
    const updatedSessionData: UserSessionData = {
      userId: session.userId,
      chatId: session.chatId,
      botId: session.botId,
      currentNodeId: originalCurrentNodeId, // Не ломаем основной flow
      variables: session.variables, // Сохраняем изменённые переменные
      lastActivity: session.lastActivity,
      locationRequest: session.locationRequest,
    };

    await this.sessionStorageService.saveSession(updatedSessionData);
  }

  private async executeNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполняем узел ${currentNode.type} (${currentNode.nodeId})`,
    );

    try {
      // Получаем обработчик для данного типа узла
      const handler = this.nodeHandlerService.getHandler(currentNode.type);

      if (handler) {
        // Важно: задаём контекст всегда. Проверка через `in` здесь не работает
        // для TypeScript-полей без runtime-инициализации.
        (handler as any)._currentContext = context;
        await handler.execute(context);

        // Сохраняем изменения сессии после выполнения узла
        const sessionData: UserSessionData = {
          userId: session.userId,
          chatId: session.chatId,
          botId: session.botId,
          currentNodeId: session.currentNodeId,
          variables: session.variables,
          lastActivity: session.lastActivity,
          locationRequest: session.locationRequest,
        };

        await this.sessionStorageService.saveSession(sessionData);
      } else {
        this.logger.warn(`Неизвестный тип узла: ${currentNode.type}`);
      }
    } catch (error) {
      // Пользователь заблокировал бота — прекращаем выполнение flow без паники
      if (error instanceof TelegramBlockedError) {
        this.logger.warn(
          `Пользователь ${error.chatId} заблокировал бота, прерываем выполнение flow на узле ${currentNode.type} (${currentNode.nodeId})`,
        );
        throw error; // Пробрасываем для обработки в processMessage / processor
      }

      this.logger.error(`Ошибка выполнения узла ${currentNode.type}:`, error);
      throw error;
    }
  }

  /**
   * Определяет начальный узел по сообщению (как при отсутствии текущего узла в сессии).
   * Используется при старте диалога и при fallback, когда сохранённый узел не найден в flow.
   * @returns { node, returnEarly } — returnEarly true, если обработали команду (/shop, /booking, custom page) и вызывающий код должен выйти.
   */
  private async resolveInitialNodeByMessage(
    bot: any,
    message: any,
    activeFlow: BotFlow,
    session: UserSession,
  ): Promise<{ node: BotFlowNode | null; returnEarly: boolean }> {
    if (message.text === "/start") {
      const startNode = activeFlow.nodes.find((node) => node.type === "start");
      if (startNode) {
        this.logger.log(`Найден START узел: ${startNode.nodeId}`);
        return { node: startNode, returnEarly: false };
      }
      this.logger.warn(`START узел не найден в flow`);
      return { node: null, returnEarly: false };
    }
    if (message.text === "/shop") {
      const shop = await this.shopRepository.findOne({
        where: { botId: bot.id },
      });
      if (shop?.buttonTypes?.includes("command")) {
        await this.handleShopCommand(bot, shop, message);
        return { node: null, returnEarly: true };
      }
      return { node: null, returnEarly: false };
    }
    if (message.text === "/booking") {
      const bookingSystem = await this.bookingSystemRepository.findOne({
        where: { botId: bot.id },
      });
      if (
        bookingSystem?.buttonTypes?.includes("command")
      ) {
        await this.handleBookingCommand(bot, bookingSystem, message);
        return { node: null, returnEarly: true };
      }
      return { node: null, returnEarly: false };
    }
    if (message.text?.startsWith("/")) {
      const pageUrl = await this.customPagesBotService.getPageUrlByCommand(
        bot.id,
        message.text,
      );
      if (pageUrl) {
        await this.handleCustomPageCommand(bot, message, pageUrl);
        return { node: null, returnEarly: true };
      }
    }
    const newMessageNode = await this.findMatchingNewMessageNode(
      activeFlow,
      message,
    );
    if (newMessageNode) {
      this.logger.log(
        `Найден подходящий NEW_MESSAGE узел: ${newMessageNode.nodeId}`,
      );
      return { node: newMessageNode, returnEarly: false };
    }
    this.logger.warn(`Подходящий NEW_MESSAGE узел не найден`);
    return { node: null, returnEarly: false };
  }

  // Поиск подходящего NEW_MESSAGE узла
  private async findMatchingNewMessageNode(
    flow: BotFlow,
    message: any,
  ): Promise<BotFlowNode | null> {
    this.logger.log(`Ищем NEW_MESSAGE узлы для сообщения: "${message.text}"`);

    const newMessageNodes = flow.nodes.filter(
      (node) => node.type === "new_message",
    );

    this.logger.log(`Найдено ${newMessageNodes.length} NEW_MESSAGE узлов`);

    // Фильтруем только те узлы, которые являются начальным условием своей ветки
    // (не имеют входящих связей от других узлов, кроме START)
    const startNodes = newMessageNodes.filter((node) =>
      this.isBranchStartNode(flow, node),
    );

    this.logger.log(
      `Найдено ${startNodes.length} NEW_MESSAGE узлов, являющихся начальными условиями веток`,
    );

    // Сначала ищем узлы с точным соответствием текста
    const exactMatches: BotFlowNode[] = [];
    const fallbackMatches: BotFlowNode[] = [];

    for (const node of startNodes) {
      this.logger.log(
        `Проверяем узел ${node.nodeId}: ${JSON.stringify(node.data?.newMessage)}`,
      );

      const newMessageData = node.data?.newMessage;
      if (!newMessageData) {
        this.logger.log(`Узел ${node.nodeId} не имеет данных newMessage`);
        continue;
      }

      const { text, contentType, caseSensitive } = newMessageData;
      let matches = true;
      let isExactMatch = false;

      this.logger.log(
        `Фильтр узла: text="${text}", contentType="${contentType}", caseSensitive=${caseSensitive}`,
      );

      // Проверяем текст сообщения
      if (text && text.trim() !== "") {
        const messageText = message.text || "";
        const filterText = caseSensitive ? text : text.toLowerCase();
        const userText = caseSensitive
          ? messageText
          : messageText.toLowerCase();

        this.logger.log(`Сравнение текста: "${userText}" vs "${filterText}"`);

        if (userText === filterText) {
          isExactMatch = true;
          this.logger.log(`Точное совпадение текста для узла ${node.nodeId}`);
        } else {
          this.logger.log(`Текст не совпадает для узла ${node.nodeId}`);
          matches = false;
        }
      }

      // Проверяем тип контента
      if (contentType && contentType !== "text") {
        const messageContentType = this.getMessageContentType(message);
        this.logger.log(
          `Сравнение типа контента: "${messageContentType}" vs "${contentType}"`,
        );

        if (messageContentType !== contentType) {
          this.logger.log(`Тип контента не совпадает для узла ${node.nodeId}`);
          matches = false;
        }
      }

      if (matches) {
        if (isExactMatch) {
          exactMatches.push(node);
          this.logger.log(
            `Узел ${node.nodeId} - точное совпадение для сообщения "${message.text}"`,
          );
        } else {
          fallbackMatches.push(node);
          this.logger.log(
            `Узел ${node.nodeId} - общий узел для сообщения "${message.text}"`,
          );
        }
      } else {
        this.logger.log(
          `Узел ${node.nodeId} не подходит для сообщения "${message.text}"`,
        );
      }
    }

    // Приоритет: сначала точные совпадения, потом общие
    if (exactMatches.length > 0) {
      this.logger.log(
        `Выбран узел с точным совпадением: ${exactMatches[0].nodeId}`,
      );
      return exactMatches[0];
    } else if (fallbackMatches.length > 0) {
      this.logger.log(`Выбран общий узел: ${fallbackMatches[0].nodeId}`);
      return fallbackMatches[0];
    }

    this.logger.log(
      `Не найден подходящий NEW_MESSAGE узел для сообщения "${message.text}"`,
    );
    return null;
  }

  // Очистка старых сессий
  async cleanupSessions(): Promise<void> {
    try {
      // Очистка сессий в SessionStorageService (старше 1 года помечаются как expired)
      await this.sessionStorageService.cleanupExpiredSessions();

      // Очистка старых данных эндпоинтов (старше 7 дней)
      const maxEndpointAge = 7 * 24 * 60 * 60 * 1000;
      const now = new Date();
      for (const [key, endpointData] of this.endpointDataStore.entries()) {
        if (
          now.getTime() - endpointData.receivedAt.getTime() >
          maxEndpointAge
        ) {
          this.endpointDataStore.delete(key);
        }
      }

      this.logger.log("Очистка сессий завершена");
    } catch (error) {
      this.logger.error("Ошибка очистки сессий:", error);
    }
  }

  /**
   * Сбрасывает все сессии для указанного бота
   * @param botId - ID бота
   */
  async resetBotSessions(botId: string): Promise<void> {
    try {
      // Получаем все активные сессии для бота
      const activeSessions =
        await this.sessionStorageService.getActiveSessionsForBot(botId);

      let deletedCount = 0;
      for (const sessionData of activeSessions) {
        await this.sessionStorageService.deleteSession(
          botId,
          sessionData.userId,
        );
        deletedCount++;
      }

      this.logger.log(`Сброшено ${deletedCount} сессий для бота ${botId}`);
    } catch (error) {
      this.logger.error(`Ошибка сброса сессий для бота ${botId}:`, error);
    }
  }

  /**
   * Сохраняет данные эндпоинта в глобальное хранилище
   */
  saveEndpointData(
    botId: string,
    nodeId: string,
    data: Record<string, any>,
  ): void {
    const key = `${botId}-${nodeId}`;
    const existingData = this.endpointDataStore.get(key);

    this.endpointDataStore.set(key, {
      data,
      receivedAt: new Date(),
      requestCount: existingData ? existingData.requestCount + 1 : 1,
    });

    this.logger.log(
      `Данные эндпоинта сохранены в глобальное хранилище: ${key}`,
    );
  }

  /**
   * Получает данные эндпоинта из глобального хранилища
   */
  getEndpointData(botId: string, nodeId: string): EndpointData | undefined {
    const key = `${botId}-${nodeId}`;
    return this.endpointDataStore.get(key);
  }

  /**
   * Проверяет, выполняется ли сейчас какая-либо ветка flow для пользователя
   * @param botId - ID бота
   * @param userId - ID пользователя
   * @returns Объект с информацией о состоянии выполнения
   */
  async getFlowExecutionStatus(
    botId: string,
    userId: string,
  ): Promise<{
    isExecuting: boolean;
    currentNodeId?: string;
    currentNodeType?: string;
    currentNodeName?: string;
    isWaitingForEndpoint?: boolean;
    sessionExists: boolean;
  }> {
    const session = await this.sessionStorageService.getSession(botId, userId);

    // Если сессии нет - точно нет выполнения
    if (!session) {
      return {
        isExecuting: false,
        sessionExists: false,
      };
    }

    // Если currentNodeId не установлен - нет активной ветки (ожидание начала)
    if (!session.currentNodeId) {
      return {
        isExecuting: false,
        sessionExists: true,
      };
    }

    // Есть currentNodeId - значит есть активная ветка
    // Проверяем, не остановилась ли она на endpoint узле в ожидании данных
    const activeFlow = await this.botFlowRepository.findOne({
      where: { botId: botId, status: FlowStatus.ACTIVE },
      relations: ["nodes"],
    });

    if (!activeFlow) {
      return {
        isExecuting: false,
        currentNodeId: session.currentNodeId,
        sessionExists: true,
      };
    }

    const currentNode = activeFlow.nodes.find(
      (node) => node.nodeId === session.currentNodeId,
    );

    if (!currentNode) {
      return {
        isExecuting: false,
        currentNodeId: session.currentNodeId,
        sessionExists: true,
      };
    }

    // Проверяем, остановился ли flow на endpoint узле в ожидании данных
    const isWaitingForEndpoint =
      currentNode.type === "endpoint" &&
      !this.getEndpointData(botId, session.currentNodeId);

    return {
      isExecuting: true,
      currentNodeId: session.currentNodeId,
      currentNodeType: currentNode.type,
      currentNodeName: currentNode.name,
      isWaitingForEndpoint,
      sessionExists: true,
    };
  }

  /**
   * Получает сессию пользователя (для внутреннего использования)
   */
  async getUserSession(
    botId: string,
    userId: string,
  ): Promise<UserSession | undefined> {
    const sessionData = await this.sessionStorageService.getSession(
      botId,
      userId,
    );
    if (!sessionData) return undefined;

    return {
      userId: sessionData.userId,
      chatId: sessionData.chatId,
      botId: sessionData.botId,
      currentNodeId: sessionData.currentNodeId,
      variables: sessionData.variables,
      lastActivity: sessionData.lastActivity,
      locationRequest: sessionData.locationRequest,
    };
  }

  /**
   * Продолжает выполнение flow для пользователя с текущей endpoint ноды
   */
  async continueFlowFromEndpoint(
    botId: string,
    userId: string,
    nodeId: string,
  ): Promise<void> {
    try {
      const sessionData = await this.sessionStorageService.getSession(
        botId,
        userId,
      );

      if (!sessionData) {
        this.logger.warn(
          `Сессия не найдена для продолжения flow: ${botId}-${userId}`,
        );
        return;
      }

      // Проверяем, что текущая нода - это endpoint нода, на которой остановился flow
      if (sessionData.currentNodeId !== nodeId) {
        this.logger.warn(
          `Текущая нода ${sessionData.currentNodeId} не совпадает с endpoint нодой ${nodeId}`,
        );
      }

      this.logger.log(
        `Продолжение flow для пользователя ${userId} с ноды ${nodeId}`,
      );

      // Создаем объект session для совместимости
      const session: UserSession = {
        userId: sessionData.userId,
        chatId: sessionData.chatId,
        botId: sessionData.botId,
        currentNodeId: sessionData.currentNodeId,
        variables: sessionData.variables,
        lastActivity: sessionData.lastActivity,
        locationRequest: sessionData.locationRequest,
      };

      // Находим активный flow
      const activeFlow = await this.botFlowRepository.findOne({
        where: { botId: botId, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });

      if (!activeFlow) {
        this.logger.warn(`Активный flow не найден для бота ${botId}`);
        return;
      }

      // Находим текущую ноду
      const currentNode = activeFlow.nodes.find(
        (node) => node.nodeId === nodeId,
      );

      if (!currentNode) {
        this.logger.error(`Нода ${nodeId} не найдена в flow`);
        return;
      }

      // Получаем бота (без проверки ownership, т.к. это внутренний вызов)
      const bot = await this.botsService.findById(botId);
      if (!bot) {
        this.logger.error(`Бот ${botId} не найден`);
        return;
      }

      // Создаем контекст выполнения
      const context: FlowContext = {
        bot,
        user: { id: parseInt(userId), first_name: "API User" },
        message: {
          from: { id: parseInt(userId), first_name: "API User" },
          chat: { id: parseInt(session.chatId) },
          text: `[Endpoint Data Received: ${nodeId}]`,
          message_id: Date.now(),
        },
        session,
        flow: activeFlow,
        currentNode,
        executeNodeCallback: this.executeNode.bind(this),
      };

      // Получаем обработчик endpoint ноды
      const handler = this.nodeHandlerService.getHandler("endpoint");

      if (!handler) {
        this.logger.error(`Обработчик для endpoint не найден`);
        return;
      }

      // Выполняем endpoint ноду (она проверит наличие данных и перейдет дальше)
      await handler.execute(context);

      this.logger.log(
        `Flow успешно продолжен для пользователя ${userId} с ноды ${nodeId}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при продолжении flow с endpoint ноды: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Проверяет, является ли узел начальным условием ветки
   * (не имеет входящих связей от других узлов, кроме START)
   */
  private isBranchStartNode(flow: BotFlow, node: BotFlowNode): boolean {
    const edges = flow.flowData?.edges || [];

    // Находим все входящие edges для этого узла
    const incomingEdges = edges.filter((edge) => edge.target === node.nodeId);

    // Если нет входящих связей - узел является начальным условием ветки
    if (incomingEdges.length === 0) {
      this.logger.log(
        `Узел ${node.nodeId} не имеет входящих связей - является начальным условием ветки`,
      );
      return true;
    }

    // Проверяем, все ли входящие связи идут только от START узлов
    const allFromStart = incomingEdges.every((edge) => {
      const sourceNode = flow.nodes.find((n) => n.nodeId === edge.source);
      const isFromStart = sourceNode?.type === "start";

      if (!isFromStart) {
        this.logger.log(
          `Узел ${node.nodeId} имеет входящую связь от узла ${edge.source} типа "${sourceNode?.type}" - не является начальным условием ветки`,
        );
      }

      return isFromStart;
    });

    if (allFromStart) {
      this.logger.log(
        `Узел ${node.nodeId} имеет входящие связи только от START узлов - является начальным условием ветки`,
      );
    }

    return allFromStart;
  }

  // Вспомогательный метод для определения типа контента сообщения
  private getMessageContentType(message: any): string {
    if (message.photo) return "photo";
    if (message.video) return "video";
    if (message.audio) return "audio";
    if (message.document) return "document";
    if (message.sticker) return "sticker";
    if (message.voice) return "voice";
    if (message.location) return "location";
    if (message.contact) return "contact";
    return "text";
  }

  /**
   * Обрабатывает команду /shop для открытия магазина
   */
  private async handleShopCommand(
    bot: any,
    shop: Shop,
    message: any,
  ): Promise<void> {
    try {
      const shopUrl =
        shop.url ||
        `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/shop/${shop.id}`;

      // Расшифровываем токен бота
      const decryptedToken = this.botsService.decryptToken(bot.token);

      // Получаем настройки команды из Shop entity
      const commandSettings = shop.buttonSettings?.command;
      const buttonText = commandSettings?.text || "🛒 Открыть магазин";
      const messageText =
        commandSettings?.messageText ||
        shop.description ||
        "Добро пожаловать в наш магазин! Нажмите кнопку ниже, чтобы открыть магазин.";

      // Отправляем сообщение с кнопкой для открытия магазина
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: {
                url: shopUrl,
              },
            },
          ],
        ],
      };

      await this.telegramService.sendMessage(
        decryptedToken,
        message.chat.id.toString(),
        messageText,
        { reply_markup: keyboard },
      );

      this.logger.log(
        `Отправлено сообщение с магазином ${shop.id} для пользователя ${message.from.id}`,
      );
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /shop: ${error.message}`);
    }
  }

  /**
   * Обрабатывает команду /booking для открытия системы бронирования
   */
  private async handleBookingCommand(
    bot: any,
    bookingSystem: BookingSystem,
    message: any,
  ): Promise<void> {
    try {
      const bookingUrl =
        bookingSystem.url ||
        `${process.env.EXTERNAL_FRONTEND_URL || "https://uforge.online"}/booking/${bookingSystem.id}`;

      // Расшифровываем токен бота
      const decryptedToken = this.botsService.decryptToken(bot.token);

      // Получаем настройки команды
      const commandSettings = bookingSystem.buttonSettings?.command;
      const buttonText = commandSettings?.text || "📅 Записаться на прием";
      const messageText =
        commandSettings?.messageText ||
        bookingSystem.description ||
        "Добро пожаловать в нашу систему бронирования! Нажмите кнопку ниже, чтобы записаться на прием.";

      // Отправляем сообщение с кнопкой для открытия системы бронирования
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: {
                url: bookingUrl,
              },
            },
          ],
        ],
      };

      await this.telegramService.sendMessage(
        decryptedToken,
        message.chat.id.toString(),
        messageText,
        { reply_markup: keyboard },
      );

      this.logger.log(
        `Отправлено сообщение с бронированием для пользователя ${message.from.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке команды /booking: ${error.message}`,
      );
    }
  }

  /**
   * Обрабатывает команду custom page для открытия страницы
   */
  private async handleCustomPageCommand(
    bot: any,
    message: any,
    pageUrl: string,
  ): Promise<void> {
    try {
      // Расшифровываем токен бота
      const decryptedToken = this.botsService.decryptToken(bot.token);

      // Отправляем сообщение с кнопкой для открытия custom page
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "Открыть страницу",
              web_app: {
                url: pageUrl,
              },
            },
          ],
        ],
      };

      const messageText = "Нажмите кнопку ниже, чтобы открыть страницу.";

      await this.telegramService.sendMessage(
        decryptedToken,
        message.chat.id.toString(),
        messageText,
        { reply_markup: keyboard },
      );

      this.logger.log(
        `Отправлено сообщение с custom page для пользователя ${message.from.id}: ${pageUrl}`,
      );
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке команды custom page: ${error.message}`,
      );
    }
  }
}
