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
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";
import { AiModelSelectorService } from "../services/ai-model-selector.service";
import { LangChainOpenRouterService } from "../../langchain-openrouter/langchain-openrouter.service";
import {
  MessageRole,
  ChatMessageDto,
} from "../../langchain-openrouter/dto/langchain-chat.dto";

/**
 * Структура данных узла AI Chat
 */
interface AiChatNodeData {
  systemPrompt: string; // Системный промпт (поддержка {{variables}})
  welcomeMessage?: string; // Приветственное сообщение (опционально)
  maxHistoryTokens?: number; // Лимит токенов истории (default: 10000)
  temperature?: number; // Температура (default: 0.7)
  exitKeywords?: string[]; // Слова для выхода из чата (например: ["стоп", "выход"])
}

/**
 * Сообщение в истории чата
 */
interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

/**
 * Сессия AI чата
 */
interface AiChatSession {
  chatHistory: ChatHistoryMessage[];
  summarizedHistory?: string;
  totalTokensEstimate: number;
  isActive: boolean;
  startedAt: number;
}

/**
 * Обработчик узла AI Chat
 *
 * Позволяет вести диалог с AI ботом с сохранением истории.
 * При превышении лимита токенов автоматически выполняет саммаризацию.
 */
@Injectable()
export class AiChatNodeHandler extends BaseNodeHandler {
  // Дополнение к системному промпту для лаконичных ответов
  private readonly conciseInstructions = `
Отвечай лаконично и по существу. Не добавляй лишних объяснений, если их не просят.
Давай прямые ответы на поставленные вопросы.`;

  // Промпт для саммаризации истории
  private readonly summarizationPrompt = `Сжато изложи ключевые моменты следующего диалога.
Сохрани важные факты, имена, даты, решения и контекст.
Ответ должен быть кратким (не более 500 слов), но информативным.
Используй структурированный формат.

Диалог:`;

  constructor(
    @InjectRepository(BotFlow)
    botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    private readonly aiModelSelector: AiModelSelectorService,
    private readonly langChainService: LangChainOpenRouterService
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
    return nodeType === "ai_chat";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, message, bot } = context;

    this.logger.log(`=== AI CHAT УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    // Получаем данные узла
    const nodeData = (currentNode.data as any)?.aiChat as AiChatNodeData;

    if (!nodeData || !nodeData.systemPrompt) {
      this.logger.warn("AI Chat: Системный промпт не задан в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const {
      systemPrompt,
      welcomeMessage,
      maxHistoryTokens = 10000,
      temperature = 0.7,
      exitKeywords = ["стоп", "выход", "конец", "/stop", "/exit"],
    } = nodeData;

    // Ключ для хранения сессии AI чата
    const chatSessionKey = `_ai_chat_${currentNode.nodeId}`;

    // Получаем или создаем сессию чата
    let chatSession: AiChatSession = session.variables[
      chatSessionKey
    ] as AiChatSession;

    // Проверяем, пришли ли мы через переход (первый раз) или это ответ пользователя
    const isFirstEntry = context.reachedThroughTransition || !chatSession;

    if (isFirstEntry) {
      this.logger.log("AI Chat: Инициализация новой сессии чата");

      // Подставляем переменные в системный промпт
      const processedSystemPrompt = this.substituteVariables(
        systemPrompt,
        context
      );

      // Создаем новую сессию
      chatSession = {
        chatHistory: [],
        totalTokensEstimate: 0,
        isActive: true,
        startedAt: Date.now(),
      };

      // Добавляем системное сообщение
      chatSession.chatHistory.push({
        role: "system",
        content: `${processedSystemPrompt}\n\n${this.conciseInstructions}`,
        timestamp: Date.now(),
      });

      chatSession.totalTokensEstimate = this.estimateTokens(
        chatSession.chatHistory[0].content
      );

      // Сохраняем сессию
      session.variables[chatSessionKey] = chatSession;

      // Отправляем приветственное сообщение, если есть
      if (welcomeMessage) {
        const processedWelcome = this.substituteVariables(
          welcomeMessage,
          context
        );
        await this.sendAndSaveMessage(
          bot,
          message.chat.id.toString(),
          processedWelcome
        );

        // Добавляем приветствие в историю
        chatSession.chatHistory.push({
          role: "assistant",
          content: processedWelcome,
          timestamp: Date.now(),
        });
        chatSession.totalTokensEstimate +=
          this.estimateTokens(processedWelcome);
      }

      // Остаемся на этом узле, ждем сообщения пользователя
      session.currentNodeId = currentNode.nodeId;
      return;
    }

    // Получаем текст сообщения пользователя
    const userMessage = message.text || "";

    this.logger.log(
      `AI Chat: Сообщение пользователя: "${userMessage.substring(0, 50)}..."`
    );

    // Проверяем ключевые слова выхода
    const lowerMessage = userMessage.toLowerCase().trim();
    const shouldExit = exitKeywords.some(
      (keyword) =>
        lowerMessage === keyword.toLowerCase() ||
        lowerMessage === keyword.toLowerCase().replace("/", "")
    );

    if (shouldExit) {
      this.logger.log("AI Chat: Пользователь завершил чат");

      // Отправляем прощальное сообщение
      await this.sendAndSaveMessage(
        bot,
        message.chat.id.toString(),
        "Чат завершен. До свидания! 👋"
      );

      // Очищаем сессию
      chatSession.isActive = false;
      session.variables[chatSessionKey] = chatSession;

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    // Добавляем сообщение пользователя в историю
    chatSession.chatHistory.push({
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    });
    chatSession.totalTokensEstimate += this.estimateTokens(userMessage);

    // Проверяем, нужна ли саммаризация
    if (chatSession.totalTokensEstimate > maxHistoryTokens) {
      this.logger.log(
        `AI Chat: Токенов (${chatSession.totalTokensEstimate}) > лимита (${maxHistoryTokens}), выполняем саммаризацию`
      );
      await this.summarizeHistory(chatSession);
    }

    try {
      // Формируем сообщения для API
      const messages = this.buildMessagesForApi(chatSession);

      // Получаем ответ от AI
      const {
        result: response,
        modelId,
        modelName,
      } = await this.aiModelSelector.executeWithFallback(async (modelId) => {
        this.logger.log(`AI Chat: Используем модель ${modelId}`);

        return this.langChainService.chat({
          messages,
          model: modelId,
          parameters: {
            maxTokens: 1000,
            temperature,
          },
        });
      });

      const aiResponse =
        response.content || "Извините, не удалось сформировать ответ.";

      // Добавляем ответ в историю (без префикса модели)
      chatSession.chatHistory.push({
        role: "assistant",
        content: aiResponse,
        timestamp: Date.now(),
      });
      chatSession.totalTokensEstimate += this.estimateTokens(aiResponse);

      // Сохраняем обновленную сессию
      session.variables[chatSessionKey] = chatSession;

      // ВРЕМЕННО: Добавляем название модели в начало сообщения
      const messageWithModelInfo = `🤖 [${modelName}]\n\n${aiResponse}`;

      // Отправляем ответ пользователю (с информацией о модели)
      await this.sendAndSaveMessage(
        bot,
        message.chat.id.toString(),
        messageWithModelInfo
      );

      this.logger.log(
        `AI Chat: Ответ отправлен (${aiResponse.length} символов), модель: ${modelName}`
      );

      // Логируем статистику
      if (response.metadata?.usage) {
        this.logger.log(
          `AI Chat: Токены - prompt: ${response.metadata.usage.promptTokens}, completion: ${response.metadata.usage.completionTokens}`
        );
      }
    } catch (error) {
      this.logger.error(`AI Chat: Ошибка получения ответа: ${error.message}`);

      await this.sendAndSaveMessage(
        bot,
        message.chat.id.toString(),
        "Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз."
      );
    }

    // Остаемся на этом узле, ждем следующее сообщение
    session.currentNodeId = currentNode.nodeId;
  }

  /**
   * Оценивает количество токенов в тексте
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;

    // Проверяем наличие кириллицы
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(text);
    const charsPerToken = hasCyrillic ? 2.5 : 4;

    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Выполняет саммаризацию истории чата
   */
  private async summarizeHistory(chatSession: AiChatSession): Promise<void> {
    try {
      // Берем только сообщения пользователя и ассистента (без системного)
      const messagesToSummarize = chatSession.chatHistory
        .filter((m) => m.role !== "system")
        .slice(0, -2); // Оставляем последние 2 сообщения без саммаризации

      if (messagesToSummarize.length < 4) {
        this.logger.log("AI Chat: Недостаточно сообщений для саммаризации");
        return;
      }

      const historyText = messagesToSummarize
        .map(
          (m) =>
            `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`
        )
        .join("\n\n");

      this.logger.log(
        `AI Chat: Саммаризуем ${messagesToSummarize.length} сообщений`
      );

      // Запрашиваем саммаризацию
      const { result: summary } =
        await this.aiModelSelector.executeWithFallback(async (modelId) => {
          return this.langChainService.chat({
            messages: [
              {
                role: MessageRole.SYSTEM,
                content:
                  "Ты - помощник для создания кратких и точных саммари диалогов.",
              },
              {
                role: MessageRole.HUMAN,
                content: `${this.summarizationPrompt}\n\n${historyText}`,
              },
            ],
            model: modelId,
            parameters: {
              maxTokens: 600,
              temperature: 0.3,
            },
          });
        });

      const summaryContent = summary.content || "";

      if (summaryContent) {
        // Сохраняем системное сообщение
        const systemMessage = chatSession.chatHistory.find(
          (m) => m.role === "system"
        );

        // Оставляем последние сообщения
        const recentMessages = chatSession.chatHistory.slice(-3);

        // Создаем новое системное сообщение с саммари
        const newSystemContent = systemMessage
          ? `${systemMessage.content}\n\n--- Краткое содержание предыдущего разговора ---\n${summaryContent}`
          : summaryContent;

        // Обновляем историю
        chatSession.chatHistory = [
          {
            role: "system",
            content: newSystemContent,
            timestamp: Date.now(),
          },
          ...recentMessages.filter((m) => m.role !== "system"),
        ];

        // Пересчитываем токены
        chatSession.totalTokensEstimate = chatSession.chatHistory.reduce(
          (sum, m) => sum + this.estimateTokens(m.content),
          0
        );

        chatSession.summarizedHistory = summaryContent;

        this.logger.log(
          `AI Chat: Саммаризация завершена, новый размер: ${chatSession.totalTokensEstimate} токенов`
        );
      }
    } catch (error) {
      this.logger.error(`AI Chat: Ошибка саммаризации: ${error.message}`);

      // При ошибке саммаризации просто обрезаем историю
      const systemMessage = chatSession.chatHistory.find(
        (m) => m.role === "system"
      );
      const recentMessages = chatSession.chatHistory.slice(-5);

      chatSession.chatHistory = [
        systemMessage!,
        ...recentMessages.filter((m) => m.role !== "system"),
      ].filter(Boolean);

      chatSession.totalTokensEstimate = chatSession.chatHistory.reduce(
        (sum, m) => sum + this.estimateTokens(m.content),
        0
      );
    }
  }

  /**
   * Формирует массив сообщений для API
   */
  private buildMessagesForApi(chatSession: AiChatSession): ChatMessageDto[] {
    return chatSession.chatHistory.map((m) => ({
      role:
        m.role === "user"
          ? MessageRole.HUMAN
          : m.role === "assistant"
            ? MessageRole.AI
            : MessageRole.SYSTEM,
      content: m.content,
    }));
  }
}
