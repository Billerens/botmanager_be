import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import {
  BotFlowNode,
  NodeType,
} from "../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../telegram/telegram.service";
import { BotsService } from "./bots.service";
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
} from "./nodes";

export interface UserSession {
  userId: string;
  chatId: string;
  botId: string;
  currentNodeId?: string;
  variables: Record<string, any>;
  lastActivity: Date;
}

export interface EndpointData {
  data: Record<string, any>;
  receivedAt: Date;
  requestCount: number;
}

@Injectable()
export class FlowExecutionService {
  private userSessions = new Map<string, UserSession>();
  // Глобальное хранилище данных эндпоинтов: ключ = "botId-nodeId"
  private endpointDataStore = new Map<string, EndpointData>();

  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly logger: CustomLoggerService,
    private readonly messagesService: MessagesService,
    private readonly nodeHandlerService: NodeHandlerService,
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
    private readonly broadcastNodeHandler: BroadcastNodeHandler
  ) {
    // Регистрируем все обработчики
    this.registerNodeHandlers();
  }

  private registerNodeHandlers(): void {
    this.nodeHandlerService.registerHandler("start", this.startNodeHandler);
    this.nodeHandlerService.registerHandler("message", this.messageNodeHandler);
    this.nodeHandlerService.registerHandler(
      "keyboard",
      this.keyboardNodeHandler
    );
    this.nodeHandlerService.registerHandler(
      "condition",
      this.conditionNodeHandler
    );
    this.nodeHandlerService.registerHandler("end", this.endNodeHandler);
    this.nodeHandlerService.registerHandler("form", this.formNodeHandler);
    this.nodeHandlerService.registerHandler("delay", this.delayNodeHandler);
    this.nodeHandlerService.registerHandler(
      "variable",
      this.variableNodeHandler
    );
    this.nodeHandlerService.registerHandler("file", this.fileNodeHandler);
    this.nodeHandlerService.registerHandler("random", this.randomNodeHandler);
    this.nodeHandlerService.registerHandler("webhook", this.webhookNodeHandler);
    this.nodeHandlerService.registerHandler(
      "integration",
      this.integrationNodeHandler
    );
    this.nodeHandlerService.registerHandler(
      "new_message",
      this.newMessageNodeHandler
    );
    this.nodeHandlerService.registerHandler(
      "endpoint",
      this.endpointNodeHandler
    );
    this.nodeHandlerService.registerHandler(
      "broadcast",
      this.broadcastNodeHandler
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
      let session = this.userSessions.get(sessionKey);
      if (!session) {
        this.logger.log(`Создаем новую сессию для пользователя ${userId}`);
        session = {
          userId,
          chatId,
          botId: bot.id,
          variables: {},
          lastActivity: new Date(),
        };
        this.userSessions.set(sessionKey, session);
      } else {
        this.logger.log(
          `Найдена существующая сессия для пользователя ${userId}`
        );
        this.logger.log(
          `Текущий узел: ${session.currentNodeId || "не установлен"}`
        );
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
          `  ${index + 1}. ID: ${node.nodeId}, Type: "${node.type}", Name: "${node.name}"`
        );
      });

      // Создаем контекст выполнения
      const context: FlowContext = {
        bot,
        user: message.from,
        message,
        session,
        flow: activeFlow,
      };

      // Определяем текущий узел
      this.logger.log(`Определяем текущий узел...`);
      if (!session.currentNodeId) {
        this.logger.log(`Сессия не имеет текущего узла, ищем подходящий`);

        // Если это команда /start, ищем START узел
        if (message.text === "/start") {
          this.logger.log(`Сообщение "/start" - ищем START узел`);
          const startNode = activeFlow.nodes.find(
            (node) => node.type === "start"
          );
          if (startNode) {
            this.logger.log(`Найден START узел: ${startNode.nodeId}`);
            context.currentNode = startNode;
            session.currentNodeId = startNode.nodeId;
          } else {
            this.logger.warn(`START узел не найден в flow`);
          }
        } else if (
          message.text === "/shop" &&
          bot.isShop &&
          bot.shopButtonTypes?.includes("command")
        ) {
          // Специальная обработка команды /shop для открытия магазина
          this.logger.log(`Команда "/shop" - открываем магазин`);
          await this.handleShopCommand(bot, message);
          return; // Не обрабатываем через flow
        } else {
          this.logger.log(`Сообщение не "/start" - ищем NEW_MESSAGE узел`);
          // Для других сообщений ищем подходящий NEW_MESSAGE узел
          const newMessageNode = this.findMatchingNewMessageNode(
            activeFlow,
            message
          );
          if (newMessageNode) {
            this.logger.log(
              `Найден подходящий NEW_MESSAGE узел: ${newMessageNode.nodeId}`
            );
            context.currentNode = newMessageNode;
            session.currentNodeId = newMessageNode.nodeId;
          } else {
            this.logger.warn(`Подходящий NEW_MESSAGE узел не найден`);
          }
        }
      } else {
        this.logger.log(`Продолжаем с текущего узла: ${session.currentNodeId}`);
        // Продолжаем с текущего узла
        context.currentNode = activeFlow.nodes.find(
          (node) => node.nodeId === session.currentNodeId
        );
        if (context.currentNode) {
          this.logger.log(
            `Найден текущий узел: ${context.currentNode.nodeId}, тип: "${context.currentNode.type}"`
          );
        } else {
          this.logger.error(
            `Текущий узел ${session.currentNodeId} не найден в flow!`
          );
        }
      }

      if (!context.currentNode) {
        this.logger.warn(
          `Не найден узел для выполнения в flow ${activeFlow.id}`
        );
        return;
      }

      // Выполняем узел
      await this.executeNode(context);
    } catch (error) {
      this.logger.error("Ошибка выполнения flow:", error);
      throw error;
    }
  }

  private async executeNode(context: FlowContext): Promise<void> {
    const { currentNode } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполняем узел ${currentNode.type} (${currentNode.nodeId})`
    );

    try {
      // Получаем обработчик для данного типа узла
      const handler = this.nodeHandlerService.getHandler(currentNode.type);

      if (handler) {
        await handler.execute(context);
      } else {
        this.logger.warn(`Неизвестный тип узла: ${currentNode.type}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка выполнения узла ${currentNode.type}:`, error);
      throw error;
    }
  }

  // Поиск подходящего NEW_MESSAGE узла
  private findMatchingNewMessageNode(
    flow: BotFlow,
    message: any
  ): BotFlowNode | null {
    this.logger.log(`Ищем NEW_MESSAGE узлы для сообщения: "${message.text}"`);

    const newMessageNodes = flow.nodes.filter(
      (node) => node.type === "new_message"
    );

    this.logger.log(`Найдено ${newMessageNodes.length} NEW_MESSAGE узлов`);

    // Сначала ищем узлы с точным соответствием текста
    const exactMatches: BotFlowNode[] = [];
    const fallbackMatches: BotFlowNode[] = [];

    for (const node of newMessageNodes) {
      this.logger.log(
        `Проверяем узел ${node.nodeId}: ${JSON.stringify(node.data?.newMessage)}`
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
        `Фильтр узла: text="${text}", contentType="${contentType}", caseSensitive=${caseSensitive}`
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
          `Сравнение типа контента: "${messageContentType}" vs "${contentType}"`
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
            `Узел ${node.nodeId} - точное совпадение для сообщения "${message.text}"`
          );
        } else {
          fallbackMatches.push(node);
          this.logger.log(
            `Узел ${node.nodeId} - общий узел для сообщения "${message.text}"`
          );
        }
      } else {
        this.logger.log(
          `Узел ${node.nodeId} не подходит для сообщения "${message.text}"`
        );
      }
    }

    // Приоритет: сначала точные совпадения, потом общие
    if (exactMatches.length > 0) {
      this.logger.log(
        `Выбран узел с точным совпадением: ${exactMatches[0].nodeId}`
      );
      return exactMatches[0];
    } else if (fallbackMatches.length > 0) {
      this.logger.log(`Выбран общий узел: ${fallbackMatches[0].nodeId}`);
      return fallbackMatches[0];
    }

    this.logger.log(
      `Не найден подходящий NEW_MESSAGE узел для сообщения "${message.text}"`
    );
    return null;
  }

  // Очистка старых сессий
  cleanupSessions(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа

    for (const [key, session] of this.userSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        this.userSessions.delete(key);
      }
    }

    // Очистка старых данных эндпоинтов (старше 7 дней)
    const maxEndpointAge = 7 * 24 * 60 * 60 * 1000;
    for (const [key, endpointData] of this.endpointDataStore.entries()) {
      if (now.getTime() - endpointData.receivedAt.getTime() > maxEndpointAge) {
        this.endpointDataStore.delete(key);
      }
    }
  }

  /**
   * Сохраняет данные эндпоинта в глобальное хранилище
   */
  saveEndpointData(
    botId: string,
    nodeId: string,
    data: Record<string, any>
  ): void {
    const key = `${botId}-${nodeId}`;
    const existingData = this.endpointDataStore.get(key);

    this.endpointDataStore.set(key, {
      data,
      receivedAt: new Date(),
      requestCount: existingData ? existingData.requestCount + 1 : 1,
    });

    this.logger.log(
      `Данные эндпоинта сохранены в глобальное хранилище: ${key}`
    );
  }

  /**
   * Получает данные эндпоинта из глобального хранилища
   */
  getEndpointData(botId: string, nodeId: string): EndpointData | undefined {
    const key = `${botId}-${nodeId}`;
    return this.endpointDataStore.get(key);
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
  private async handleShopCommand(bot: any, message: any): Promise<void> {
    try {
      const shopUrl =
        bot.shopUrl ||
        `${process.env.FRONTEND_URL || "https://botmanagertest.online"}/shop/${bot.id}`;

      // Отправляем сообщение с кнопкой для открытия магазина
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🛒 Открыть магазин",
              web_app: {
                url: shopUrl,
              },
            },
          ],
        ],
      };

      await this.telegramService.sendMessage(
        bot.token,
        message.chat.id.toString(),
        bot.shopDescription ||
          "Добро пожаловать в наш магазин! Нажмите кнопку ниже, чтобы открыть магазин.",
        { reply_markup: keyboard }
      );

      this.logger.log(
        `Отправлено сообщение с магазином для пользователя ${message.from.id}`
      );
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /shop: ${error.message}`);
    }
  }
}
