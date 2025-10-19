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
        telegramMessageId: telegramResponse.message_id,
        telegramChatId: chatId,
        telegramUserId: bot.id,
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

  /**
   * Отправляет документ через Telegram API и сохраняет его в базу данных
   */
  protected async sendAndSaveDocument(
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
        telegramMessageId: telegramResponse.message_id,
        telegramChatId: chatId,
        telegramUserId: bot.id,
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

  /**
   * Поиск следующего узла по edges
   */
  protected findNextNodeId(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): string | null {
    // Ищем edge, который начинается с текущего узла
    const edge = context.flow.flowData?.edges?.find(
      (edge) =>
        edge.source === currentNodeId &&
        (!sourceHandle || edge.sourceHandle === sourceHandle)
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

  /**
   * Находит следующий узел по конкретному выходу
   */
  protected findNextNodeIdByOutput(
    context: FlowContext,
    currentNodeId: string,
    outputId: string
  ): string | null {
    this.logger.log(
      `Поиск следующего узла для выхода ${outputId} узла ${currentNodeId}`
    );

    // Логируем структуру flow
    this.logger.log(`=== СТРУКТУРА FLOW ===`);
    this.logger.log(`Flow ID: ${context.flow.id}`);
    this.logger.log(
      `Flow Data: ${JSON.stringify(context.flow.flowData, null, 2)}`
    );

    // Логируем все edges
    this.logger.log(`=== ВСЕ EDGES ===`);
    if (context.flow.flowData?.edges) {
      context.flow.flowData.edges.forEach((edge, index) => {
        this.logger.log(`Edge ${index}: ${JSON.stringify(edge)}`);
      });
    } else {
      this.logger.log(`Edges не найдены в flowData`);
    }

    // Логируем все узлы
    this.logger.log(`=== ВСЕ УЗЛЫ ===`);
    context.flow.nodes.forEach((node, index) => {
      this.logger.log(
        `Узел ${index}: ID=${node.nodeId}, Type=${node.type}, Data=${JSON.stringify(node.data)}`
      );
    });

    // Ищем edge, который начинается с текущего узла и конкретного выхода
    const edge = context.flow.flowData?.edges?.find(
      (edge) => edge.source === currentNodeId && edge.sourceHandle === outputId
    );

    if (edge) {
      this.logger.log(`Найден edge: ${JSON.stringify(edge)}`);
      return edge.target;
    }

    this.logger.warn(
      `Edge не найден для выхода ${outputId} узла ${currentNodeId}`
    );

    // Попробуем найти edge без sourceHandle (fallback)
    // Для keyboard узлов с множественными выходами используем индекс кнопки
    const allEdgesFromNode = context.flow.flowData?.edges?.filter(
      (edge) => edge.source === currentNodeId
    );

    if (allEdgesFromNode && allEdgesFromNode.length > 0) {
      // Если это keyboard узел и ищем button-X выход
      if (
        outputId.startsWith("button-") &&
        currentNodeId.includes("keyboard")
      ) {
        const buttonIndex = parseInt(outputId.replace("button-", ""));
        this.logger.log(
          `Keyboard fallback: ищем edge для кнопки с индексом ${buttonIndex}`
        );

        if (buttonIndex >= 0 && buttonIndex < allEdgesFromNode.length) {
          const selectedEdge = allEdgesFromNode[buttonIndex];
          this.logger.log(
            `Найден fallback edge для кнопки ${buttonIndex}: ${JSON.stringify(selectedEdge)}`
          );
          return selectedEdge.target;
        } else {
          this.logger.warn(
            `Индекс кнопки ${buttonIndex} выходит за пределы доступных edges (${allEdgesFromNode.length})`
          );
        }
      }

      // Обычный fallback - берем первый edge
      const fallbackEdge = allEdgesFromNode[0];
      this.logger.log(
        `Найден обычный fallback edge: ${JSON.stringify(fallbackEdge)}`
      );
      return fallbackEdge.target;
    }

    this.logger.warn(`Fallback edge также не найден для узла ${currentNodeId}`);
    return null;
  }

  /**
   * Переходит к конкретному узлу и выполняет его
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

      this.logger.log(`Переход к узлу: ${nodeId}`);
      if (this.executeNodeCallback) {
        context.currentNode = targetNode;
        await this.executeNodeCallback(context);
      }
    } else {
      this.logger.warn(`Узел с ID ${nodeId} не найден`);
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
        `Не найден следующий узел для выхода ${outputId} узла ${currentNodeId}`
      );
    }
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
      if (trimmedPath === "chat.id") {
        return message.chat?.id?.toString() || "";
      }
      if (trimmedPath === "message.text") {
        return message.text || "";
      }
      if (trimmedPath === "timestamp") {
        return new Date().toLocaleString("ru-RU");
      }
      if (trimmedPath === "date") {
        return new Date().toLocaleDateString("ru-RU");
      }
      if (trimmedPath === "time") {
        return new Date().toLocaleTimeString("ru-RU");
      }

      // Обработка переменных сессии
      if (session.variables && session.variables[trimmedPath] !== undefined) {
        return session.variables[trimmedPath];
      }

      // Если переменная не найдена, возвращаем пустую строку для правильной работы isEmpty
      this.logger.warn(`Переменная не найдена: ${trimmedPath}`);
      return "";
    });

    return result;
  }
}
