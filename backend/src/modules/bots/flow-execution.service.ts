import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import {
  BotFlowNode,
  NodeType,
} from "../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../telegram/telegram.service";
import { BotsService } from "./bots.service";

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
  private readonly logger = new Logger(FlowExecutionService.name);
  private userSessions = new Map<string, UserSession>();

  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    private readonly telegramService: TelegramService,
    private readonly botsService: BotsService
  ) {}

  async processMessage(bot: any, message: any): Promise<void> {
    try {
      const userId = message.from.id.toString();
      const chatId = message.chat.id.toString();
      const sessionKey = `${bot.id}-${userId}`;

      // Получаем или создаем сессию пользователя
      let session = this.userSessions.get(sessionKey);
      if (!session) {
        session = {
          userId,
          chatId,
          botId: bot.id,
          variables: {},
          lastActivity: new Date(),
        };
        this.userSessions.set(sessionKey, session);
      }

      // Находим активный flow для бота
      const activeFlow = await this.botFlowRepository.findOne({
        where: { botId: bot.id, status: FlowStatus.ACTIVE },
        relations: ["nodes"],
      });

      if (!activeFlow) {
        this.logger.warn(`Нет активного flow для бота ${bot.id}`);
        return;
      }

      // Создаем контекст выполнения
      const context: FlowContext = {
        bot,
        user: message.from,
        message,
        session,
        flow: activeFlow,
      };

      // Определяем текущий узел
      if (!session.currentNodeId) {
        // Начинаем с START узла
        const startNode = activeFlow.nodes.find(
          (node) => node.type === NodeType.START
        );
        if (startNode) {
          context.currentNode = startNode;
          session.currentNodeId = startNode.nodeId;
        }
      } else {
        // Продолжаем с текущего узла
        context.currentNode = activeFlow.nodes.find(
          (node) => node.nodeId === session.currentNodeId
        );
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
        case NodeType.START:
          await this.executeStartNode(context);
          break;
        case NodeType.MESSAGE:
          await this.executeMessageNode(context);
          break;
        case NodeType.KEYBOARD:
          await this.executeKeyboardNode(context);
          break;
        case NodeType.CONDITION:
          await this.executeConditionNode(context);
          break;
        case NodeType.API:
          await this.executeApiNode(context);
          break;
        case NodeType.FORM:
          await this.executeFormNode(context);
          break;
        case NodeType.DELAY:
          await this.executeDelayNode(context);
          break;
        case NodeType.VARIABLE:
          await this.executeVariableNode(context);
          break;
        case NodeType.FILE:
          await this.executeFileNode(context);
          break;
        case NodeType.RANDOM:
          await this.executeRandomNode(context);
          break;
        case NodeType.END:
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
    const { currentNode, session } = context;

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
    const decryptedToken = this.botsService.decryptToken(bot.token);

    const messageText = currentNode.data?.text || "Привет!";
    const parseMode = currentNode.data?.parseMode || "HTML";

    // Отправляем сообщение
    await this.telegramService.sendMessage(
      decryptedToken,
      message.chat.id,
      messageText,
      {
        parse_mode: parseMode,
      }
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
  }

  private async executeKeyboardNode(context: FlowContext): Promise<void> {
    const { currentNode, bot, message, session } = context;
    const decryptedToken = this.botsService.decryptToken(bot.token);

    this.logger.log("Keyboard node data:", currentNode.data);

    const messageText = currentNode.data?.text || "Выберите опцию:";
    const buttons = currentNode.data?.buttons || [];
    const isInline = currentNode.data?.isInline || false;

    this.logger.log("Keyboard buttons:", buttons);
    this.logger.log("Is inline:", isInline);

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

    // Отправляем сообщение с клавиатурой
    await this.telegramService.sendMessage(
      decryptedToken,
      message.chat.id,
      messageText,
      {
        reply_markup: telegramKeyboard,
      }
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

    await this.telegramService.sendMessage(
      bot.token,
      session.chatId,
      formMessage
    );

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

    await this.telegramService.sendMessage(
      bot.token,
      session.chatId,
      "Нажмите кнопку для отправки формы:",
      { reply_markup: keyboard }
    );

    // Переходим к следующему узлу
    const nextNodeId = this.getNextNodeId(context, currentNode.nodeId);
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
    const nextNodeId = this.getNextNodeId(context, currentNode.nodeId);
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
    const { name, value, operation, scope } = variableData;

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
    const nextNodeId = this.getNextNodeId(context, currentNode.nodeId);
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
          await this.telegramService.sendMessage(
            bot.token,
            session.chatId,
            `📁 Пожалуйста, загрузите файл.\nРазрешенные типы: ${fileData.accept?.join(", ")}\nМаксимальный размер: ${fileData.maxSize}МБ`
          );
          break;
        case "download":
          if (fileData.url) {
            await this.telegramService.sendDocument(
              bot.token,
              session.chatId,
              fileData.url,
              fileData.filename
            );
          }
          break;
        case "send":
          if (fileData.url) {
            await this.telegramService.sendDocument(
              bot.token,
              session.chatId,
              fileData.url,
              fileData.filename
            );
          }
          break;
      }
    } catch (error) {
      this.logger.error("Ошибка работы с файлом:", error);
      await this.telegramService.sendMessage(
        bot.token,
        session.chatId,
        "❌ Произошла ошибка при работе с файлом"
      );
    }

    // Переходим к следующему узлу
    const nextNodeId = this.getNextNodeId(context, currentNode.nodeId);
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
    const nextNodeId = this.getNextNodeId(context, currentNode.nodeId);
    if (nextNodeId) {
      session.currentNodeId = nextNodeId;
    }
  }
}
