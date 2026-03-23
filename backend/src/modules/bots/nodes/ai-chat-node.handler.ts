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
import { StreamingResponseService } from "../services/streaming-response.service";
import {
  MessageRole,
  ChatMessageDto,
} from "../../langchain-openrouter/dto/langchain-chat.dto";
import { AiProvidersService } from "../../ai-providers/ai-providers.service";

/**
 * Структура данных узла AI Chat
 */
interface AiChatNodeData {
  systemPrompt: string;
  welcomeMessage?: string;
  maxHistoryTokens?: number;
  temperature?: number;
  exitKeywords?: string[];
  /** Предпочтительная модель из списка OpenRouter. Игнорируется если задан aiProviderId. */
  preferredModelId?: string;
  /** ID профиля AI-провайдера. Если задан — используется кастомный провайдер вместо системного OpenRouter. */
  aiProviderId?: string;
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
    private readonly langChainService: LangChainOpenRouterService,
    private readonly streamingService: StreamingResponseService,
    private readonly aiProvidersService: AiProvidersService,
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

    const nodeData = currentNode.data.aiChat;

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
      preferredModelId,
      aiProviderId,
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

      // Переходим к следующему узлу (если в flow есть исходящий edge)
      await this.moveToNextNode(context, currentNode.nodeId);

      // Если перехода не было (нет исходящего edge из ai_chat), сбрасываем текущий узел,
      // чтобы следующее сообщение обрабатывалось по обычному флоу (NEW_MESSAGE / start).
      if (session.currentNodeId === currentNode.nodeId) {
        session.currentNodeId = undefined;
      }
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
      const messages = this.buildMessagesForApi(chatSession);
      const chatId = message.chat.id.toString();
      const decryptedToken = this.botsService.decryptToken(bot.token);

      // === Ветка 1: Кастомный AI-провайдер ===
      if (aiProviderId?.trim()) {
        this.logger.log(`AI Chat: используем кастомный провайдер ${aiProviderId}`);
        let aiResponse = "";
        try {
          const { model, resolvedModel, providerName } =
            await this.aiProvidersService.buildChatOpenAI(
              aiProviderId.trim(),
              bot.ownerId,
              {
                modelName: preferredModelId?.trim() || undefined,
                temperature,
                maxTokens: 1000,
              },
            );
          this.logger.log(`AI Chat: провайдер "${providerName}", модель ${resolvedModel}`);

          const rawMessages = messages.map((m) => ({
            role: m.role === MessageRole.SYSTEM ? "system" : m.role === MessageRole.HUMAN ? "user" : "assistant",
            content: m.content,
          }));

          const streamGenerator = (async function* () {
            const stream = await model.stream(rawMessages);
            for await (const chunk of stream) {
              if (chunk.content) {
                const textChunk = 
                  typeof chunk.content === "string" 
                    ? chunk.content 
                    : Array.isArray(chunk.content)
                      ? (chunk.content as any[]).map((b) => (typeof b === "string" ? b : b?.text ?? b?.content ?? "")).join("")
                      : String(chunk.content ?? "");
                if (textChunk) {
                  yield textChunk;
                }
              }
            }
          })();

          const messagePrefix = `🤖 [${resolvedModel}]\n\n`;

          const result = await this.streamingService.sendStreamingResponse(
            bot,
            chatId,
            streamGenerator,
            {
              messagePrefix,
              initialMessage: "Думаю...",
              showCursor: true,
              throttleMs: 800,
              onTypingNeeded: async () => {
                await this.telegramService.sendChatAction(
                  decryptedToken,
                  chatId,
                  "typing"
                );
              },
            }
          );

          aiResponse = result.fullResponse || "Извините, не удалось сформировать ответ.";
          
          this.logger.log(
            `AI Chat [Custom]: Streaming ответ отправлен (${aiResponse.length} символов)`
          );
        } catch (providerError) {
          this.logger.error(`AI Chat: ошибка кастомного провайдера: ${providerError.message}`);
          await this.sendAndSaveMessage(bot, chatId, "Извините, произошла ошибка при обработке вашего сообщения.");
        }
        if (aiResponse) {
          chatSession.chatHistory.push({ role: "assistant", content: aiResponse, timestamp: Date.now() });
          chatSession.totalTokensEstimate += this.estimateTokens(aiResponse);
          session.variables[chatSessionKey] = chatSession;
        }
        session.currentNodeId = currentNode.nodeId;
        return;
      }

      // === Ветка 2: Системный OpenRouter (стандартное поведение) ===
      let modelId: string;
      let modelName: string;
      if (preferredModelId?.trim()) {
        const available = await this.aiModelSelector.getAvailableModels();
        const preferred = available.find((m) => m.id === preferredModelId.trim());
        if (preferred) {
          modelId = preferred.id;
          modelName = preferred.name;
          this.logger.log(`AI Chat: Используем выбранную модель ${modelId}`);
        } else {
          this.logger.warn(
            `AI Chat: предпочтительная модель "${preferredModelId}" не в списке, выбор автоматический`
          );
          const streaming = await this.aiModelSelector.getStreamingModel();
          modelId = streaming.modelId;
          modelName = streaming.modelName;
        }
      } else {
        const streaming = await this.aiModelSelector.getStreamingModel();
        modelId = streaming.modelId;
        modelName = streaming.modelName;
      }
      this.logger.log(`AI Chat: Используем модель ${modelId}`);

      // Пытаемся использовать streaming
      let aiResponse = "";
      let streamingSucceeded = false;

      try {
        // Создаём stream generator
        const streamGenerator = this.langChainService.chatStream({
          messages,
          model: modelId,
          parameters: {
            maxTokens: 1000,
            temperature,
          },
        });

        // ВРЕМЕННО: Добавляем название модели в начало сообщения
        const messagePrefix = `🤖 [${modelName}]\n\n`;

        // Используем streaming сервис для отправки
        const result = await this.streamingService.sendStreamingResponse(
          bot,
          chatId,
          streamGenerator,
          {
            messagePrefix,
            initialMessage: "Думаю...",
            showCursor: true,
            throttleMs: 800,
            onTypingNeeded: async () => {
              await this.telegramService.sendChatAction(
                decryptedToken,
                chatId,
                "typing"
              );
            },
          }
        );

        aiResponse = result.fullResponse;
        streamingSucceeded = result.wasStreamed;

        this.logger.log(
          `AI Chat: Streaming ответ отправлен (${aiResponse.length} символов, ${result.editCount} редактирований)`
        );
      } catch (streamError) {
        this.logger.warn(
          `AI Chat: Streaming не удался, используем fallback: ${streamError.message}`
        );

        // Fallback: запускаем typing и используем обычный запрос
        const stopTyping = this.streamingService.startTypingIndicator(
          bot,
          chatId
        );

        try {
          // При предпочтительной модели пробуем только её; иначе fallback по списку
          const doChat = (mid: string) =>
            this.langChainService.chat({
              messages,
              model: mid,
              parameters: { maxTokens: 1000, temperature },
            });
          let response: Awaited<ReturnType<typeof doChat>>;
          let fallbackModelId: string;
          let fallbackModelName: string;
          if (preferredModelId?.trim()) {
            const available = await this.aiModelSelector.getAvailableModels();
            const preferred = available.find((m) => m.id === preferredModelId.trim());
            if (preferred) {
              response = await doChat(preferred.id);
              fallbackModelId = preferred.id;
              fallbackModelName = preferred.name;
            } else {
              const fallback = await this.aiModelSelector.executeWithFallback(doChat);
              response = fallback.result;
              fallbackModelId = fallback.modelId;
              fallbackModelName = fallback.modelName;
            }
          } else {
            const fallback = await this.aiModelSelector.executeWithFallback(doChat);
            response = fallback.result;
            fallbackModelId = fallback.modelId;
            fallbackModelName = fallback.modelName;
          }

          aiResponse =
            typeof response.content === "string"
              ? response.content
              : Array.isArray(response.content)
                ? (response.content as { text?: string; content?: string }[])
                    .map((b) => (typeof b === "string" ? b : b?.text ?? b?.content ?? ""))
                    .join("")
                : String(response.content ?? "");
          if (!aiResponse) aiResponse = "Извините, не удалось сформировать ответ.";

          // Отправляем обычным способом
          const messageWithModelInfo = `🤖 [${fallbackModelName}]\n\n${aiResponse}`;
          await this.sendAndSaveMessage(bot, chatId, messageWithModelInfo);

          this.logger.log(
            `AI Chat: Fallback ответ отправлен (${aiResponse.length} символов), модель: ${fallbackModelName}`
          );

          // Логируем статистику
          if (response.metadata?.usage) {
            this.logger.log(
              `AI Chat: Токены - prompt: ${response.metadata.usage.promptTokens}, completion: ${response.metadata.usage.completionTokens}`
            );
          }
        } finally {
          stopTyping();
        }
      }

      // Добавляем ответ в историю (без префикса модели)
      if (aiResponse) {
        chatSession.chatHistory.push({
          role: "assistant",
          content: aiResponse,
          timestamp: Date.now(),
        });
        chatSession.totalTokensEstimate += this.estimateTokens(aiResponse);

        // Сохраняем обновленную сессию
        session.variables[chatSessionKey] = chatSession;
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
