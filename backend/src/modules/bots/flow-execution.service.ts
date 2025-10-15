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

export interface UserSession {
  userId: string;
  chatId: string;
  botId: string;
  currentNodeId?: string;
  variables: Record<string, any>;
  lastActivity: Date;
}

export interface FlowContext {
  bot: any;
  user: any;
  message: any;
  session: UserSession;
  flow: BotFlow;
  currentNode?: BotFlowNode;
}

@Injectable()
export class FlowExecutionService {
  private userSessions = new Map<string, UserSession>();

  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService,
    private readonly logger: CustomLoggerService,
    private readonly messagesService: MessagesService
  ) {}

  /**
   * Отправляет сообщение через Telegram API и сохраняет его в базу данных
   */
  private async sendAndSaveMessage(
    bot: any,
    chatId: string,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
      disable_web_page_preview?: boolean;
    } = {}
  ): Promise<void> {
    const decryptedToken = this.botsService.decryptToken(bot.token);

    // Отправляем сообщение через Telegram API
    const telegramResponse = await this.telegramService.sendMessage(
      decryptedToken,
      chatId,
      text,
      options
    );

    if (telegramResponse) {
      // Сохраняем исходящее сообщение в базу данных
      await this.messagesService.create({
        botId: bot.id,
        telegramMessageId: telegramResponse.message_id, // Используем реальный ID из ответа Telegram API
        telegramChatId: chatId,
        telegramUserId: bot.id, // Для исходящих сообщений userId = botId
        type: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        text: text,
        keyboard: options.reply_markup
          ? {
              type: options.reply_markup.inline_keyboard ? "inline" : "reply",
              buttons:
                options.reply_markup.inline_keyboard ||
                options.reply_markup.keyboard ||
                [],
            }
          : null,
        metadata: {
          firstName: bot.name || "Bot",
          lastName: "",
          username: bot.username,
          isBot: true,
          replyToMessageId: options.reply_to_message_id,
        },
        isProcessed: true,
        processedAt: new Date(),
      });

      this.logger.log(
        `Исходящее сообщение отправлено и сохранено для чата ${chatId}`
      );
    } else {
      this.logger.error(`Ошибка отправки сообщения в чат ${chatId}`);
    }
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
        } else if (message.text === "/shop" && bot.isShop) {
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
    const { currentNode, bot, message, session } = context;

    if (!currentNode) return;

    this.logger.log(
      `Выполняем узел ${currentNode.type} (${currentNode.nodeId})`
    );

    try {
      switch (currentNode.type) {
        case "start":
          await this.executeStartNode(context);
          break;
        case "new_message":
          await this.executeNewMessageNode(context);
          break;
        case "message":
          await this.executeMessageNode(context);
          break;
        case "keyboard":
          await this.executeKeyboardNode(context);
          break;
        case "condition":
          await this.executeConditionNode(context);
          break;
        case "api":
          await this.executeApiNode(context);
          break;
        case "form":
          await this.executeFormNode(context);
          break;
        case "delay":
          await this.executeDelayNode(context);
          break;
        case "variable":
          await this.executeVariableNode(context);
          break;
        case "file":
          await this.executeFileNode(context);
          break;
        case "random":
          await this.executeRandomNode(context);
          break;
        case "webhook":
          await this.executeWebhookNode(context);
          break;
        case "integration":
          await this.executeIntegrationNode(context);
          break;
        case "end":
          await this.executeEndNode(context);
          break;
        default:
          this.logger.warn(`Неизвестный тип узла: ${currentNode.type}`);
      }
    } catch (error) {
      this.logger.error(`Ошибка выполнения узла ${currentNode.type}:`, error);
      throw error;
    }
  }

  private async executeStartNode(context: FlowContext): Promise<void> {
    const { currentNode, session, message } = context;

    // START узел работает только с командой /start
    if (message.text !== "/start") {
      this.logger.log(`START узел игнорирует сообщение: ${message.text}`);
      return;
    }

    this.logger.log("Обрабатываем команду /start");

    // Ищем следующий узел по edges
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
      session.lastActivity = new Date();

      // Находим и выполняем следующий узел
      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode) {
        context.currentNode = nextNode;
        await this.executeNode(context);
      }
    } else {
      this.logger.warn(
        `Нет следующего узла для START узла ${currentNode.nodeId}`
      );
    }
  }

  private async executeMessageNode(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;

    const messageText = currentNode.data?.text || "Привет!";
    const parseMode = currentNode.data?.parseMode || "HTML";

    // Отправляем сообщение и сохраняем в БД
    await this.sendAndSaveMessage(bot, message.chat.id, messageText, {
      parse_mode: parseMode,
    });

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
      session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode) {
        context.currentNode = nextNode;
        await this.executeNode(context);
      }
    }
  }

  private async executeKeyboardNode(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;

    this.logger.log("Keyboard node data:", JSON.stringify(currentNode.data));

    const messageText = currentNode.data?.text || "Выберите опцию:";
    const buttons = currentNode.data?.buttons || [];
    const isInline = currentNode.data?.isInline || false;

    this.logger.log("Keyboard buttons:", JSON.stringify(buttons));
    this.logger.log("Is inline:", String(isInline));

    // Создаем клавиатуру
    let telegramKeyboard;
    if (isInline) {
      telegramKeyboard = {
        inline_keyboard: buttons.map((button) => [
          {
            text: button.text,
            callback_data: button.callbackData || button.text,
          },
        ]),
      };
    } else {
      telegramKeyboard = {
        keyboard: buttons.map((button) => [
          {
            text: button.text,
          },
        ]),
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    }

    // Отправляем сообщение с клавиатурой и сохраняем в БД
    await this.sendAndSaveMessage(bot, message.chat.id, messageText, {
      reply_markup: telegramKeyboard,
    });

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
      session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode) {
        context.currentNode = nextNode;
        await this.executeNode(context);
      }
    }
  }

  private async executeConditionNode(context: FlowContext): Promise<void> {
    const { currentNode, message, session } = context;

    // Простая логика условий (можно расширить)
    const condition = currentNode.data?.condition;
    if (!condition) {
      this.logger.warn("Условие не задано в узле");
      return;
    }

    const userInput = message.text || "";
    let conditionMet = false;

    switch (condition.operator) {
      case "equals":
        conditionMet = userInput === condition.value;
        break;
      case "contains":
        conditionMet = userInput
          .toLowerCase()
          .includes(condition.value.toLowerCase());
        break;
      case "startsWith":
        conditionMet = userInput
          .toLowerCase()
          .startsWith(condition.value.toLowerCase());
        break;
      default:
        this.logger.warn(`Неизвестный оператор условия: ${condition.operator}`);
    }

    // Переходим к следующему узлу (в реальной реализации можно добавить trueNodeId/falseNodeId)
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
      session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode) {
        context.currentNode = nextNode;
        await this.executeNode(context);
      }
    }
  }

  private async executeApiNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    // Простая реализация API узла (можно расширить)
    const apiConfig = currentNode.data?.webhook;
    if (!apiConfig) {
      this.logger.warn("API конфигурация не задана в узле");
      return;
    }

    try {
      // Здесь можно добавить HTTP запрос
      this.logger.log(`Выполняем API запрос: ${apiConfig.url}`);

      // Переходим к следующему узлу
      const nextNodeId = currentNode.data?.nextNodeId;
      if (nextNodeId) {
        session.currentNodeId = nextNodeId;
        session.lastActivity = new Date();

        const nextNode = context.flow.nodes.find(
          (node) => node.nodeId === nextNodeId
        );
        if (nextNode) {
          context.currentNode = nextNode;
          await this.executeNode(context);
        }
      }
    } catch (error) {
      this.logger.error("Ошибка выполнения API узла:", error);
    }
  }

  private async executeEndNode(context: FlowContext): Promise<void> {
    const { session } = context;

    // Завершаем сессию
    session.currentNodeId = undefined;
    session.lastActivity = new Date();

    this.logger.log(`Диалог завершен для пользователя ${session.userId}`);
  }

  // Поиск следующего узла по edges
  private findNextNodeId(
    context: FlowContext,
    currentNodeId: string
  ): string | null {
    // Ищем edge, который начинается с текущего узла
    const edge = context.flow.flowData?.edges?.find(
      (edge) => edge.source === currentNodeId
    );

    if (edge) {
      return edge.target;
    }

    // Если edge не найден, ищем в данных узла
    const currentNode = context.flow.nodes.find(
      (node) => node.nodeId === currentNodeId
    );

    return currentNode?.data?.nextNodeId || null;
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
  }

  // Выполнение узла формы
  private async executeFormNode(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;

    if (!currentNode?.data?.form) {
      this.logger.warn("Данные формы не найдены");
      return;
    }

    const formData = currentNode.data.form;

    // Отправляем сообщение с формой
    const formMessage = `📝 ${formData.fields
      .map((field) => `${field.label}${field.required ? " *" : ""}`)
      .join("\n")}\n\n${formData.submitText}`;

    await this.sendAndSaveMessage(bot, session.chatId, formMessage);

    // Создаем клавиатуру для отправки формы
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: formData.submitText,
            callback_data: `form_submit_${currentNode.nodeId}`,
          },
        ],
      ],
    };

    await this.sendAndSaveMessage(
      bot,
      session.chatId,
      "Нажмите кнопку для отправки формы:",
      { reply_markup: keyboard }
    );

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }

  // Выполнение узла задержки
  private async executeDelayNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.delay) {
      this.logger.warn("Данные задержки не найдены");
      return;
    }

    const delayData = currentNode.data.delay;
    let delayMs = delayData.value;

    // Конвертируем в миллисекунды
    switch (delayData.unit) {
      case "seconds":
        delayMs *= 1000;
        break;
      case "minutes":
        delayMs *= 60 * 1000;
        break;
      case "hours":
        delayMs *= 60 * 60 * 1000;
        break;
      case "days":
        delayMs *= 24 * 60 * 60 * 1000;
        break;
    }

    this.logger.log(`Задержка на ${delayMs}мс`);

    // Ждем указанное время
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }

  // Выполнение узла переменной
  private async executeVariableNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.variable) {
      this.logger.warn("Данные переменной не найдены");
      return;
    }

    const variableData = currentNode.data.variable;
    const { name, value, operation } = variableData;

    // Выполняем операцию с переменной
    switch (operation) {
      case "set":
        session.variables[name] = value;
        break;
      case "append":
        session.variables[name] = (session.variables[name] || "") + value;
        break;
      case "prepend":
        session.variables[name] = value + (session.variables[name] || "");
        break;
      case "increment":
        session.variables[name] = (
          parseInt(session.variables[name] || "0") + 1
        ).toString();
        break;
      case "decrement":
        session.variables[name] = (
          parseInt(session.variables[name] || "0") - 1
        ).toString();
        break;
    }

    this.logger.log(`Переменная ${name} = ${session.variables[name]}`);

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }

  // Выполнение узла файла
  private async executeFileNode(context: FlowContext): Promise<void> {
    const { currentNode, bot, session } = context;

    if (!currentNode?.data?.file) {
      this.logger.warn("Данные файла не найдены");
      return;
    }

    const fileData = currentNode.data.file;

    try {
      switch (fileData.type) {
        case "upload":
          await this.sendAndSaveMessage(
            bot,
            session.chatId,
            `📁 Пожалуйста, загрузите файл.\nРазрешенные типы: ${fileData.accept?.join(", ")}\nМаксимальный размер: ${fileData.maxSize}МБ`
          );
          break;
        case "download":
        case "send":
          if (fileData.url) {
            await this.sendAndSaveDocument(bot, session.chatId, fileData.url, {
              caption: fileData.filename || "file",
            });
          } else {
            await this.sendAndSaveMessage(
              bot,
              session.chatId,
              "📁 Файл не найден"
            );
          }
          break;
        default:
          await this.sendAndSaveMessage(
            bot,
            session.chatId,
            "📁 Неизвестный тип файла"
          );
      }
    } catch (error) {
      this.logger.error("Ошибка работы с файлом:", error);
      await this.sendAndSaveMessage(
        bot,
        session.chatId,
        "❌ Произошла ошибка при работе с файлом"
      );
    }

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }

  // Выполнение узла случайного выбора
  private async executeRandomNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.random) {
      this.logger.warn("Данные случайного выбора не найдены");
      return;
    }

    const randomData = currentNode.data.random;
    const { options, variable } = randomData;

    if (!options || options.length === 0) {
      this.logger.warn("Нет вариантов для случайного выбора");
      return;
    }

    // Вычисляем общий вес
    const totalWeight = options.reduce(
      (sum, option) => sum + (option.weight || 1),
      0
    );

    // Генерируем случайное число
    const random = Math.random() * totalWeight;

    // Выбираем вариант
    let currentWeight = 0;
    let selectedOption = options[0];

    for (const option of options) {
      currentWeight += option.weight || 1;
      if (random <= currentWeight) {
        selectedOption = option;
        break;
      }
    }

    // Сохраняем результат в переменную
    if (variable) {
      session.variables[variable] = selectedOption.value;
    }

    this.logger.log(`Случайный выбор: ${selectedOption.value}`);

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }

  // Выполнение узла webhook
  private async executeWebhookNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.webhook) {
      this.logger.warn("Данные webhook не найдены");
      return;
    }

    const webhookData = currentNode.data.webhook;
    const { url, method, headers, body, timeout } = webhookData;

    try {
      this.logger.log(`Выполняем webhook запрос: ${method} ${url}`);

      // Здесь можно добавить HTTP запрос с помощью axios или fetch
      // Пока просто логируем
      this.logger.log(
        `Webhook данные: ${JSON.stringify({
          url,
          method,
          headers,
          body,
          timeout,
        })}`
      );

      // Переходим к следующему узлу
      const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
      if (nextNodeId) {
        session.currentNodeId = nextNodeId;
        session.lastActivity = new Date();

        const nextNode = context.flow.nodes.find(
          (node) => node.nodeId === nextNodeId
        );
        if (nextNode) {
          context.currentNode = nextNode;
          await this.executeNode(context);
        }
      }
    } catch (error) {
      this.logger.error("Ошибка выполнения webhook узла:", error);
    }
  }

  // Выполнение узла интеграции
  private async executeIntegrationNode(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.integration) {
      this.logger.warn("Данные интеграции не найдены");
      return;
    }

    const integrationData = currentNode.data.integration;
    const { service, action, config } = integrationData;

    try {
      this.logger.log(`Выполняем интеграцию: ${service}.${action}`);

      // Здесь можно добавить логику для различных сервисов
      switch (service) {
        case "crm":
          this.logger.log("Интеграция с CRM системой");
          break;
        case "email":
          this.logger.log("Интеграция с email сервисом");
          break;
        case "analytics":
          this.logger.log("Интеграция с аналитикой");
          break;
        case "payment":
          this.logger.log("Интеграция с платежной системой");
          break;
        case "custom":
          this.logger.log("Кастомная интеграция");
          break;
        default:
          this.logger.warn(`Неизвестный сервис интеграции: ${service}`);
      }

      this.logger.log(`Конфигурация интеграции: ${JSON.stringify(config)}`);

      // Переходим к следующему узлу
      const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
      if (nextNodeId) {
        session.currentNodeId = nextNodeId;
        session.lastActivity = new Date();

        const nextNode = context.flow.nodes.find(
          (node) => node.nodeId === nextNodeId
        );
        if (nextNode) {
          context.currentNode = nextNode;
          await this.executeNode(context);
        }
      }
    } catch (error) {
      this.logger.error("Ошибка выполнения интеграции:", error);
    }
  }

  // Выполнение узла нового сообщения
  private async executeNewMessageNode(context: FlowContext): Promise<void> {
    const { currentNode, session, message } = context;

    this.logger.log(`=== ВЫПОЛНЕНИЕ NEW_MESSAGE УЗЛА ===`);
    this.logger.log(`Узел: ${currentNode.nodeId}`);
    this.logger.log(`Сообщение: "${message.text}"`);

    if (!currentNode?.data?.newMessage) {
      this.logger.warn("Данные нового сообщения не найдены");
      return;
    }

    const newMessageData = currentNode.data.newMessage;
    const { text, contentType, caseSensitive } = newMessageData;

    this.logger.log(`Данные узла: ${JSON.stringify(newMessageData)}`);

    // Проверяем соответствие сообщения условиям узла
    let messageMatches = true;

    // Проверяем текст сообщения
    if (text && text.trim() !== "") {
      const messageText = message.text || "";
      const filterText = caseSensitive ? text : text.toLowerCase();
      const userText = caseSensitive ? messageText : messageText.toLowerCase();

      this.logger.log(`Проверка текста: "${userText}" vs "${filterText}"`);

      if (userText !== filterText) {
        this.logger.log(`Текст не совпадает`);
        messageMatches = false;
      }
    }

    // Проверяем тип контента
    if (contentType && contentType !== "text") {
      const messageContentType = this.getMessageContentType(message);
      this.logger.log(
        `Проверка типа контента: "${messageContentType}" vs "${contentType}"`
      );

      if (messageContentType !== contentType) {
        this.logger.log(`Тип контента не совпадает`);
        messageMatches = false;
      }
    }

    if (!messageMatches) {
      this.logger.log(
        `Сообщение не соответствует условиям узла NEW_MESSAGE: ${message.text}`
      );
      return;
    }

    this.logger.log(
      `Сообщение соответствует условиям узла NEW_MESSAGE: ${message.text}`
    );

    // Переходим к следующему узлу
    const nextNodeId = this.findNextNodeId(context, currentNode.nodeId);
    this.logger.log(`Следующий узел: ${nextNodeId}`);

    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
      session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode) {
        this.logger.log(
          `Переходим к узлу: ${nextNode.nodeId} (${nextNode.type})`
        );
        context.currentNode = nextNode;
        await this.executeNode(context);
      } else {
        this.logger.error(`Следующий узел ${nextNodeId} не найден!`);
      }
    } else {
      this.logger.warn(
        `Нет следующего узла для NEW_MESSAGE узла ${currentNode.nodeId}`
      );
    }
  }

  /**
   * Отправляет документ через Telegram API и сохраняет его в базу данных
   */
  private async sendAndSaveDocument(
    bot: any,
    chatId: string,
    document: string | Buffer,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {}
  ): Promise<void> {
    const decryptedToken = this.botsService.decryptToken(bot.token);

    // Отправляем документ через Telegram API
    const telegramResponse = await this.telegramService.sendDocument(
      decryptedToken,
      chatId,
      document,
      options
    );

    if (telegramResponse) {
      // Сохраняем исходящее сообщение в базу данных
      await this.messagesService.create({
        botId: bot.id,
        telegramMessageId: telegramResponse.message_id, // Используем реальный ID из ответа Telegram API
        telegramChatId: chatId,
        telegramUserId: bot.id, // Для исходящих сообщений userId = botId
        type: MessageType.OUTGOING,
        contentType: MessageContentType.DOCUMENT,
        text: options.caption || null,
        media: {
          fileId: telegramResponse.document?.file_id || "",
          fileUniqueId: telegramResponse.document?.file_unique_id || "",
          fileName: telegramResponse.document?.file_name || "document",
          fileSize: telegramResponse.document?.file_size || 0,
          mimeType:
            telegramResponse.document?.mime_type || "application/octet-stream",
        },
        keyboard: options.reply_markup
          ? {
              type: options.reply_markup.inline_keyboard ? "inline" : "reply",
              buttons:
                options.reply_markup.inline_keyboard ||
                options.reply_markup.keyboard ||
                [],
            }
          : null,
        metadata: {
          firstName: bot.name || "Bot",
          lastName: "",
          username: bot.username,
          isBot: true,
          replyToMessageId: options.reply_to_message_id,
        },
        isProcessed: true,
        processedAt: new Date(),
      });
    }
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
              text: bot.shopButtonSettings?.inline_button?.text || "🛒 Открыть магазин",
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
