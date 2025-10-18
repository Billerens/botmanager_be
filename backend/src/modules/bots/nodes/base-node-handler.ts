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

  /**
   * Переходит к следующему узлу и выполняет его
   */
  protected async moveToNextNode(
    context: FlowContext,
    currentNodeId: string
  ): Promise<void> {
    const nextNodeId = this.findNextNodeId(context, currentNodeId);
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
}
