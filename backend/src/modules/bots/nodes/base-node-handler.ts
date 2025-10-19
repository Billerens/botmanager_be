import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import {
  MessageType,
  MessageContentType,
} from "../../../database/entities/message.entity";
import { FlowContext, INodeHandler } from "./base-node-handler.interface";

@Injectable()
export abstract class BaseNodeHandler implements INodeHandler {
  protected executeNodeCallback?: (context: FlowContext) => Promise<void>;

  constructor(
    @InjectRepository(BotFlow)
    protected readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    protected readonly botFlowNodeRepository: Repository<BotFlowNode>,
    protected readonly telegramService: TelegramService,
    protected readonly botsService: BotsService,
    protected readonly logger: CustomLoggerService,
    protected readonly messagesService: MessagesService
  ) {}

  setExecuteNodeCallback(
    callback: (context: FlowContext) => Promise<void>
  ): void {
    this.executeNodeCallback = callback;
  }

  abstract execute(context: FlowContext): Promise<void>;
  abstract canHandle(nodeType: string): boolean;

  /**
   * Отправляет сообщение через Telegram API и сохраняет его в базу данных
   */
  protected async sendAndSaveMessage(
    bot: any,
    chatId: string,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {}
  ): Promise<any> {
    try {
      this.logger.log(`[TELEGRAM] Отправка сообщения в чат ${chatId} через бота ${bot.id}`);
      this.logger.log(`[TELEGRAM] Токен бота: ${bot.token ? `${bot.token.substring(0, 10)}...` : 'НЕ НАЙДЕН'}`);
      
      // Отправляем сообщение через Telegram API
      const message = await this.telegramService.sendMessage(
        bot.token,
        chatId,
        text,
        options
      );

      if (!message || !message.message_id) {
        throw new Error(`Telegram API вернул пустой ответ или отсутствует message_id`);
      }

      this.logger.log(`[TELEGRAM] Сообщение отправлено успешно, ID: ${message.message_id}`);

      // Сохраняем сообщение в базу данных
      await this.messagesService.create({
        botId: bot.id,
        telegramChatId: chatId,
        telegramMessageId: message.message_id,
        type: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        text: text,
        metadata: {
          parseMode: options.parse_mode,
          replyMarkup: options.reply_markup,
          replyToMessageId: options.reply_to_message_id,
        } as any,
      });

      return message;
    } catch (error) {
      this.logger.error(`[TELEGRAM] Ошибка отправки сообщения: ${error.message}`);
      this.logger.error(`[TELEGRAM] Детали ошибки:`, error);
      
      // Проверяем тип ошибки
      if (error.response) {
        this.logger.error(`[TELEGRAM] HTTP статус: ${error.response.status}`);
        this.logger.error(`[TELEGRAM] HTTP данные:`, error.response.data);
        
        if (error.response.status === 404) {
          throw new Error(`Бот не найден или токен недействителен. Проверьте токен бота: ${bot.token ? `${bot.token.substring(0, 10)}...` : 'НЕ НАЙДЕН'}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Отправляет документ через Telegram API и сохраняет его в базу данных
   */
  protected async sendAndSaveDocument(
    bot: any,
    chatId: string,
    documentUrl: string,
    options: {
      caption?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
      reply_to_message_id?: number;
    } = {}
  ): Promise<any> {
    try {
      // Отправляем документ через Telegram API
      const message = await this.telegramService.sendDocument(
        bot.token,
        chatId,
        documentUrl,
        options
      );

      // Сохраняем сообщение в базу данных
      await this.messagesService.create({
        botId: bot.id,
        telegramChatId: chatId,
        telegramMessageId: message.message_id,
        type: MessageType.OUTGOING,
        contentType: MessageContentType.DOCUMENT,
        text: options.caption || "",
        metadata: {
          documentUrl,
          parseMode: options.parse_mode,
          replyMarkup: options.reply_markup,
          replyToMessageId: options.reply_to_message_id,
        } as any,
      });

      return message;
    } catch (error) {
      this.logger.error(`Ошибка отправки документа: ${error.message}`);
      throw error;
    }
  }

  /**
   * Переходит к указанному узлу и выполняет его
   */
  protected async moveToNode(
    context: FlowContext,
    nodeId: string
  ): Promise<void> {
    const targetNode = context.flow.nodes.find(
      (node) => node.nodeId === nodeId
    );

    if (targetNode) {
      context.session.currentNodeId = nodeId;
      context.session.lastActivity = new Date();

      this.logger.log(`[FLOW] Переход к узлу: ${nodeId}`);
      if (this.executeNodeCallback) {
        context.currentNode = targetNode;
        await this.executeNodeCallback(context);
      }
    } else {
      this.logger.warn(`[FLOW] Узел с ID ${nodeId} не найден`);
    }
  }

  /**
   * Переходит к следующему узлу и выполняет его
   */
  protected async moveToNextNode(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): Promise<void> {
    const nextNodeId = this.findNextNodeId(
      context,
      currentNodeId,
      sourceHandle
    );
    if (nextNodeId) {
      context.session.currentNodeId = nextNodeId;
      context.session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode && this.executeNodeCallback) {
        context.currentNode = nextNode;
        await this.executeNodeCallback(context);
      }
    }
  }

  /**
   * Переходит к следующему узлу по конкретному выходу и выполняет его
   */
  protected async moveToNextNodeByOutput(
    context: FlowContext,
    currentNodeId: string,
    outputId: string
  ): Promise<void> {
    const nextNodeId = this.findNextNodeIdByOutput(
      context,
      currentNodeId,
      outputId
    );
    if (nextNodeId) {
      context.session.currentNodeId = nextNodeId;
      context.session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode && this.executeNodeCallback) {
        context.currentNode = nextNode;
        await this.executeNodeCallback(context);
      }
    } else {
      this.logger.warn(
        `[FLOW] Не найден следующий узел для выхода ${outputId} узла ${currentNodeId}`
      );
    }
  }

  /**
   * Поиск следующего узла по edges
   */
  protected findNextNodeId(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): string | null {
    this.logger.log(
      `[FLOW] Поиск следующего узла: ${currentNodeId}, handle: ${sourceHandle || "default"}`
    );

    // Ищем edge, который начинается с текущего узла
    const edge = context.flow.flowData?.edges?.find(
      (edge) =>
        edge.source === currentNodeId &&
        (!sourceHandle || edge.sourceHandle === sourceHandle)
    );

    if (edge) {
      this.logger.log(
        `[FLOW] Найден edge: ${edge.source} -> ${edge.target} (handle: ${edge.sourceHandle})`
      );
      return edge.target;
    }

    this.logger.log(`[FLOW] Edge не найден, ищем в данных узла`);
    // Если edge не найден, ищем в данных узла
    const currentNode = context.flow.nodes.find(
      (node) => node.nodeId === currentNodeId
    );

    return currentNode?.data?.nextNodeId || null;
  }

  /**
   * Находит следующий узел по конкретному выходу
   */
  protected findNextNodeIdByOutput(
    context: FlowContext,
    currentNodeId: string,
    outputId: string
  ): string | null {
    this.logger.log(
      `[FLOW] Поиск узла по выходу: ${currentNodeId} -> ${outputId}`
    );

    // Ищем edge, который начинается с текущего узла и конкретного выхода
    const edge = context.flow.flowData?.edges?.find(
      (edge) => edge.source === currentNodeId && edge.sourceHandle === outputId
    );

    if (edge) {
      this.logger.log(
        `[FLOW] Найден edge по выходу: ${edge.source} -> ${edge.target} (handle: ${edge.sourceHandle})`
      );
      return edge.target;
    }

    this.logger.warn(
      `[FLOW] Edge не найден для выхода ${outputId} узла ${currentNodeId}`
    );
    return null;
  }

  /**
   * Вспомогательный метод для определения типа контента сообщения
   */
  protected getMessageContentType(message: any): string {
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
   * Подставляет переменные в текст
   * Поддерживает синтаксис: {{variableName}}, {{user.firstName}}, {{session.data}}
   */
  protected substituteVariables(text: string, context: FlowContext): string {
    if (!text || typeof text !== "string") {
      return text || "";
    }

    const { session, message } = context;

    // Подставляем переменные сессии
    let result = text.replace(/\{\{([^}]+)\}\}/g, (match, variablePath) => {
      const trimmedPath = variablePath.trim();

      // Обработка специальных переменных
      if (trimmedPath === "user.firstName") {
        return message.from?.first_name || "Пользователь";
      }
      if (trimmedPath === "user.lastName") {
        return message.from?.last_name || "";
      }
      if (trimmedPath === "user.username") {
        return message.from?.username || "";
      }
      if (trimmedPath === "user.id") {
        return message.from?.id?.toString() || "";
      }
      if (trimmedPath === "message.text") {
        return message.text || "";
      }
      if (trimmedPath === "chat.id") {
        return message.chat?.id?.toString() || "";
      }
      if (trimmedPath === "timestamp") {
        return new Date().toISOString();
      }
      if (trimmedPath === "date") {
        return new Date().toLocaleDateString("ru-RU");
      }
      if (trimmedPath === "time") {
        return new Date().toLocaleTimeString("ru-RU");
      }

      // Обработка переменных сессии
      const sessionValue = session.variables[trimmedPath];
      if (sessionValue !== undefined) {
        return String(sessionValue);
      }

      // Если переменная не найдена, возвращаем исходный текст
      return match;
    });

    return result;
  }

  /**
   * Обновляет статистику выполнения узла
   */
  protected async updateNodeStats(
    nodeId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const node = await this.botFlowNodeRepository.findOne({
        where: { nodeId },
      });

      if (node) {
        node.executionCount += 1;
        node.lastExecutedAt = new Date();

        if (success) {
          node.successCount += 1;
          node.lastError = null;
        } else {
          node.errorCount += 1;
          node.lastError = error || "Неизвестная ошибка";
        }

        await this.botFlowNodeRepository.save(node);
      }
    } catch (error) {
      this.logger.error(`Ошибка обновления статистики узла: ${error.message}`);
    }
  }
}
