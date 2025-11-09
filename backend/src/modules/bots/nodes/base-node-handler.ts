import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";
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
    protected readonly messagesService: MessagesService,
    protected readonly activityLogService: ActivityLogService
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
      // Обрабатываем keyboard: расплющиваем двумерный массив в одномерный
      let processedKeyboard = null;
      if (options.reply_markup) {
        const buttonsArray =
          options.reply_markup.inline_keyboard ||
          options.reply_markup.keyboard ||
          [];
        // Расплющиваем двумерный массив (массив массивов кнопок) в одномерный
        const flatButtons =
          Array.isArray(buttonsArray) &&
          buttonsArray.length > 0 &&
          Array.isArray(buttonsArray[0])
            ? buttonsArray.flat()
            : buttonsArray;

        processedKeyboard = {
          type: options.reply_markup.inline_keyboard ? "inline" : "reply",
          buttons: flatButtons,
        };
      }

      const savedMessage = await this.messagesService.create({
        botId: bot.id,
        telegramMessageId: telegramResponse.message_id,
        telegramChatId: chatId,
        telegramUserId: bot.id,
        type: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        text: text,
        keyboard: processedKeyboard,
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

      // Логируем отправку сообщения
      if (bot.ownerId) {
        this.activityLogService
          .create({
            type: ActivityType.MESSAGE_SENT,
            level: ActivityLevel.SUCCESS,
            message: `Сообщение отправлено в чат ${chatId}`,
            userId: bot.ownerId,
            botId: bot.id,
            metadata: {
              chatId,
              messageId: savedMessage.id,
              telegramMessageId: telegramResponse.message_id,
              hasKeyboard: !!processedKeyboard,
            },
          })
          .catch((error) => {
            this.logger.error("Ошибка логирования отправки сообщения:", error);
          });
      }
    } else {
      this.logger.error(`Ошибка отправки сообщения в чат ${chatId}`);

      // Логируем ошибку отправки сообщения
      if (bot.ownerId) {
        this.activityLogService
          .create({
            type: ActivityType.MESSAGE_FAILED,
            level: ActivityLevel.ERROR,
            message: `Ошибка отправки сообщения в чат ${chatId}`,
            userId: bot.ownerId,
            botId: bot.id,
            metadata: {
              chatId,
              errorMessage: "Не удалось отправить сообщение через Telegram API",
            },
          })
          .catch((error) => {
            this.logger.error("Ошибка логирования ошибки отправки:", error);
          });
      }
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
      // Обрабатываем keyboard: расплющиваем двумерный массив в одномерный
      let processedKeyboard = null;
      if (options.reply_markup) {
        const buttonsArray =
          options.reply_markup.inline_keyboard ||
          options.reply_markup.keyboard ||
          [];
        // Расплющиваем двумерный массив (массив массивов кнопок) в одномерный
        const flatButtons =
          Array.isArray(buttonsArray) &&
          buttonsArray.length > 0 &&
          Array.isArray(buttonsArray[0])
            ? buttonsArray.flat()
            : buttonsArray;

        processedKeyboard = {
          type: options.reply_markup.inline_keyboard ? "inline" : "reply",
          buttons: flatButtons,
        };
      }

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
        keyboard: processedKeyboard,
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
   * Находит все следующие узлы по edges (для узлов с множественными выходами)
   */
  protected findAllNextNodeIds(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): string[] {
    // Ищем все edges, которые начинаются с текущего узла
    const edges =
      context.flow.flowData?.edges?.filter(
        (edge) =>
          edge.source === currentNodeId &&
          (!sourceHandle || edge.sourceHandle === sourceHandle)
      ) || [];

    if (edges.length > 0) {
      return edges.map((edge) => edge.target);
    }

    // Если edges не найдены, ищем в данных узла
    const currentNode = context.flow.nodes.find(
      (node) => node.nodeId === currentNodeId
    );

    if (currentNode?.data?.nextNodeId) {
      return [currentNode.data.nextNodeId];
    }

    return [];
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
        context.reachedThroughTransition = true;
        await this.executeNodeCallback(context);
      }
    } else {
      this.logger.warn(`Узел с ID ${nodeId} не найден`);
    }
  }

  /**
   * Переходит к следующему узлу и выполняет его
   * Если sourceHandle указан (например, для условных узлов), обрабатывает только эту ветку
   * Если sourceHandle не указан, обрабатывает все выходные связи (стандартное поведение)
   */
  protected async moveToNextNode(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): Promise<void> {
    // Если указан sourceHandle (например, "true"/"false" для condition узлов),
    // обрабатываем только одну конкретную ветку
    if (sourceHandle) {
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
          context.reachedThroughTransition = true;
          await this.executeNodeCallback(context);
        }
      }
      return;
    }

    // Если sourceHandle не указан, обрабатываем все выходные связи
    // Это стандартное поведение для большинства узлов
    const nextNodeIds = this.findAllNextNodeIds(
      context,
      currentNodeId,
      sourceHandle
    );

    if (nextNodeIds.length === 0) {
      // Нет следующих узлов - ничего не делаем
      return;
    }

    if (nextNodeIds.length === 1) {
      // Только один следующий узел - обрабатываем его напрямую (оптимизация)
      const nextNodeId = nextNodeIds[0];
      context.session.currentNodeId = nextNodeId;
      context.session.lastActivity = new Date();

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );
      if (nextNode && this.executeNodeCallback) {
        context.currentNode = nextNode;
        context.reachedThroughTransition = true;
        await this.executeNodeCallback(context);
      }
      return;
    }

    // Несколько следующих узлов - обрабатываем все последовательно
    this.logger.log(
      `Найдено ${nextNodeIds.length} следующих узлов для узла ${currentNodeId}, обрабатываем все`
    );

    // Сохраняем исходный currentNodeId для восстановления после обработки всех узлов
    const originalCurrentNodeId = context.currentNode?.nodeId;

    // Обрабатываем все следующие узлы последовательно
    for (let i = 0; i < nextNodeIds.length; i++) {
      const nextNodeId = nextNodeIds[i];
      this.logger.log(
        `Обработка следующего узла ${i + 1}/${nextNodeIds.length}: ${nextNodeId}`
      );

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );

      if (nextNode && this.executeNodeCallback) {
        // Устанавливаем текущий узел для выполнения
        context.currentNode = nextNode;
        context.session.currentNodeId = nextNodeId;
        context.session.lastActivity = new Date();
        context.reachedThroughTransition = true;

        // Выполняем узел
        await this.executeNodeCallback(context);
      } else {
        this.logger.warn(`Узел ${nextNodeId} не найден в flow`);
      }
    }

    // После обработки всех узлов проверяем, есть ли у них дальнейшие связи
    // Если у последнего узла есть следующие узлы, продолжаем выполнение от него
    // Если нет, возвращаемся к исходному узлу, чтобы пользователь мог снова отправить сообщение
    if (nextNodeIds.length > 0) {
      const lastNodeId = nextNodeIds[nextNodeIds.length - 1];
      const lastNodeHasNext = this.findNextNodeId(context, lastNodeId) !== null;

      if (lastNodeHasNext) {
        // У последнего узла есть дальнейшие связи, продолжаем от него
        this.logger.log(
          `У последнего узла ${lastNodeId} есть дальнейшие связи, продолжаем выполнение`
        );
        context.session.currentNodeId = lastNodeId;
      } else {
        // У обработанных узлов нет дальнейших связей, возвращаемся к исходному узлу
        // Это позволяет пользователю снова отправить сообщение и получить ответ
        if (originalCurrentNodeId) {
          this.logger.log(
            `У обработанных узлов нет дальнейших связей, возвращаемся к исходному узлу ${originalCurrentNodeId}`
          );
          const originalNode = context.flow.nodes.find(
            (node) => node.nodeId === originalCurrentNodeId
          );
          if (originalNode) {
            context.currentNode = originalNode;
            context.session.currentNodeId = originalCurrentNodeId;
          }
        }
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
        context.reachedThroughTransition = true;
        await this.executeNodeCallback(context);
      }
    } else {
      this.logger.warn(
        `Не найден следующий узел для выхода ${outputId} узла ${currentNodeId}`
      );
    }
  }

  /**
   * Переходит ко всем следующим узлам и выполняет их последовательно
   * Используется для узлов с множественными выходами (например, NewMessageNode)
   */
  protected async moveToAllNextNodes(
    context: FlowContext,
    currentNodeId: string,
    sourceHandle?: string
  ): Promise<void> {
    const nextNodeIds = this.findAllNextNodeIds(
      context,
      currentNodeId,
      sourceHandle
    );

    this.logger.log(
      `Найдено ${nextNodeIds.length} следующих узлов для узла ${currentNodeId}`
    );

    if (nextNodeIds.length === 0) {
      this.logger.warn(`Не найдено следующих узлов для узла ${currentNodeId}`);
      return;
    }

    // Сохраняем исходный currentNodeId для восстановления после обработки всех узлов
    const originalCurrentNodeId = context.currentNode?.nodeId;

    // Обрабатываем все следующие узлы последовательно
    for (let i = 0; i < nextNodeIds.length; i++) {
      const nextNodeId = nextNodeIds[i];
      this.logger.log(
        `Обработка следующего узла ${i + 1}/${nextNodeIds.length}: ${nextNodeId}`
      );

      const nextNode = context.flow.nodes.find(
        (node) => node.nodeId === nextNodeId
      );

      if (nextNode && this.executeNodeCallback) {
        // Устанавливаем текущий узел для выполнения
        context.currentNode = nextNode;
        context.session.currentNodeId = nextNodeId;
        context.session.lastActivity = new Date();
        context.reachedThroughTransition = true;

        // Выполняем узел
        await this.executeNodeCallback(context);
      } else {
        this.logger.warn(`Узел ${nextNodeId} не найден в flow`);
      }
    }

    // После обработки всех узлов проверяем, есть ли у них дальнейшие связи
    // Если у последнего узла есть следующие узлы, продолжаем выполнение от него
    // Если нет, возвращаемся к исходному узлу (например, NewMessageNode),
    // чтобы пользователь мог снова отправить сообщение
    if (nextNodeIds.length > 0) {
      const lastNodeId = nextNodeIds[nextNodeIds.length - 1];
      const lastNodeHasNext = this.findNextNodeId(context, lastNodeId) !== null;

      if (lastNodeHasNext) {
        // У последнего узла есть дальнейшие связи, продолжаем от него
        this.logger.log(
          `У последнего узла ${lastNodeId} есть дальнейшие связи, продолжаем выполнение`
        );
        context.session.currentNodeId = lastNodeId;
      } else {
        // У обработанных узлов нет дальнейших связей, возвращаемся к исходному узлу
        // Это позволяет пользователю снова отправить сообщение и получить ответ
        if (originalCurrentNodeId) {
          this.logger.log(
            `У обработанных узлов нет дальнейших связей, возвращаемся к исходному узлу ${originalCurrentNodeId}`
          );
          const originalNode = context.flow.nodes.find(
            (node) => node.nodeId === originalCurrentNodeId
          );
          if (originalNode) {
            context.currentNode = originalNode;
            context.session.currentNodeId = originalCurrentNodeId;
          }
        }
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
