import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  LangChainChatRequestDto,
  SimpleTextRequestDto,
  LangChainChatResponseDto,
  MessageRole,
  ChatMessageDto,
  ResponseMetadataDto,
} from "./dto/langchain-chat.dto";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";

/**
 * Сервис для работы с OpenRouter через LangChain
 * Предоставляет современный интерфейс для взаимодействия с LLM моделями
 */
@Injectable()
export class LangChainOpenRouterService {
  private readonly logger = new Logger(LangChainOpenRouterService.name);
  private readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  private readonly httpReferer?: string;
  private readonly xTitle?: string;

  // Настройки прокси
  private readonly proxyUrl?: string;
  private readonly proxyCheckTimeout: number;
  private proxyAvailable: boolean = false;
  private proxyAgent?: HttpsProxyAgent<string>;

  constructor(private readonly configService: ConfigService) {
    // Получаем конфигурацию OpenRouter
    this.apiKey = this.configService.get<string>("openrouter.apiKey");
    this.baseUrl = this.configService.get<string>("openrouter.baseUrl");
    this.defaultModel = this.configService.get<string>(
      "openrouter.defaultModel"
    );
    this.httpReferer = this.configService.get<string>("openrouter.httpReferer");
    this.xTitle = this.configService.get<string>("openrouter.xTitle");

    // Получаем настройки прокси
    this.proxyUrl = this.configService.get<string>("openrouter.proxyUrl");
    this.proxyCheckTimeout =
      this.configService.get<number>("openrouter.proxyCheckTimeout") || 5000;

    if (!this.apiKey) {
      this.logger.warn(
        "OpenRouter API key не настроен. Проверьте переменную OPENROUTER_API_KEY"
      );
    }

    // Инициализируем прокси, если настроен
    if (this.proxyUrl) {
      this.initializeProxy();
    }

    this.logger.log(
      `LangChain OpenRouter сервис инициализирован с моделью: ${this.defaultModel}`
    );
  }

  /**
   * Инициализация и проверка прокси
   */
  private async initializeProxy(): Promise<void> {
    if (!this.proxyUrl) {
      return;
    }

    try {
      this.logger.log(`Проверка доступности прокси: ${this.proxyUrl}`);

      const isAvailable = await this.checkProxyAvailability();

      if (isAvailable) {
        this.proxyAgent = new HttpsProxyAgent(this.proxyUrl);
        this.proxyAvailable = true;
        this.logger.log(`✓ Прокси ${this.proxyUrl} доступен и настроен`);
      } else {
        this.proxyAvailable = false;
        this.logger.warn(
          `✗ Прокси ${this.proxyUrl} недоступен, будет использоваться прямое подключение`
        );
      }
    } catch (error) {
      this.proxyAvailable = false;
      this.logger.warn(
        `Ошибка при инициализации прокси: ${error.message}. Используется прямое подключение`
      );
    }
  }

  /**
   * Проверяет доступность прокси
   */
  private async checkProxyAvailability(): Promise<boolean> {
    if (!this.proxyUrl) {
      return false;
    }

    try {
      const proxyAgent = new HttpsProxyAgent(this.proxyUrl);

      // Пытаемся сделать простой запрос через прокси
      const response = await axios.get("https://www.google.com", {
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
        timeout: this.proxyCheckTimeout,
        validateStatus: () => true, // Принимаем любой статус
      });

      return response.status >= 200 && response.status < 500;
    } catch (error) {
      this.logger.debug(`Прокси недоступен: ${error.message}`);
      return false;
    }
  }

  /**
   * Переподключение к прокси (для повторной проверки доступности)
   */
  async reconnectProxy(): Promise<boolean> {
    if (!this.proxyUrl) {
      return false;
    }

    await this.initializeProxy();
    return this.proxyAvailable;
  }

  /**
   * Создает экземпляр ChatOpenAI для работы с OpenRouter
   */
  private createChatModel(modelName?: string, parameters?: any): ChatOpenAI {
    const model = modelName || this.defaultModel;

    this.logger.debug(`Создание ChatOpenAI модели: ${model}`);

    // Логируем использование прокси
    if (this.proxyAvailable && this.proxyAgent) {
      this.logger.debug(`Используется прокси: ${this.proxyUrl}`);
    }

    // Формируем заголовки для OpenRouter
    const defaultHeaders: Record<string, string> = {};

    if (this.httpReferer) {
      defaultHeaders["HTTP-Referer"] = this.httpReferer;
    }

    if (this.xTitle) {
      defaultHeaders["X-Title"] = this.xTitle;
    }

    // Формируем параметры для modelKwargs
    const modelKwargs: any = {};

    // Добавляем top_k если указан
    if (parameters?.topK) {
      modelKwargs.top_k = parameters.topK;
    }

    // ВАЖНО: Добавляем настройки приватности для OpenRouter
    // Это предотвращает использование данных для обучения моделей
    modelKwargs.provider = {
      data_collection: "deny", // Запрещаем сбор данных для обучения
    };

    // Формируем конфигурацию
    const configuration: any = {
      baseURL: this.baseUrl,
      defaultHeaders,
    };

    // Добавляем прокси-агент, если доступен
    if (this.proxyAvailable && this.proxyAgent) {
      configuration.httpAgent = this.proxyAgent;
      configuration.httpsAgent = this.proxyAgent;
    }

    return new ChatOpenAI({
      modelName: model,
      openAIApiKey: this.apiKey,
      temperature: parameters?.temperature ?? 0.7,
      maxTokens: parameters?.maxTokens ?? 4000,
      topP: parameters?.topP,
      frequencyPenalty: parameters?.frequencyPenalty,
      presencePenalty: parameters?.presencePenalty,
      stop: parameters?.stopSequences,
      configuration,
      // Дополнительные параметры для OpenRouter
      modelKwargs,
    });
  }

  /**
   * Конвертирует DTO сообщения в формат LangChain
   */
  private convertToLangChainMessage(message: ChatMessageDto): BaseMessage {
    switch (message.role) {
      case MessageRole.SYSTEM:
        return new SystemMessage(message.content);
      case MessageRole.HUMAN:
        return new HumanMessage(message.content);
      case MessageRole.AI:
        return new AIMessage(message.content);
      default:
        this.logger.warn(
          `Неизвестная роль сообщения: ${message.role}, используется как HumanMessage`
        );
        return new HumanMessage(message.content);
    }
  }

  /**
   * Основной метод для работы с чатом через LangChain
   */
  async chat(
    request: LangChainChatRequestDto
  ): Promise<LangChainChatResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Обработка запроса чата с ${request.messages.length} сообщениями`
      );

      // Валидация
      if (!request.messages || request.messages.length === 0) {
        throw new BadRequestException(
          "Необходимо предоставить хотя бы одно сообщение"
        );
      }

      // Создаем модель
      const chatModel = this.createChatModel(request.model, request.parameters);

      // Конвертируем сообщения
      const langchainMessages = request.messages.map((msg) =>
        this.convertToLangChainMessage(msg)
      );

      // Выполняем запрос
      const response = await chatModel.invoke(langchainMessages);

      const endTime = Date.now();
      const generationTime = (endTime - startTime) / 1000;

      // Формируем метаданные ответа
      const metadata: ResponseMetadataDto = {
        model: request.model || this.defaultModel,
        finishReason:
          (response.response_metadata as any)?.finish_reason || "stop",
        generationTime,
        usage: (response.response_metadata as any)?.tokenUsage
          ? {
              promptTokens: (response.response_metadata as any).tokenUsage
                .promptTokens,
              completionTokens: (response.response_metadata as any).tokenUsage
                .completionTokens,
              totalTokens: (response.response_metadata as any).tokenUsage
                .totalTokens,
            }
          : undefined,
        additionalMetadata: response.response_metadata,
      };

      this.logger.log(
        `Чат завершен успешно за ${generationTime.toFixed(2)}s. Токены: ${metadata.usage?.totalTokens || "N/A"}`
      );

      return {
        content: response.content as string,
        metadata,
        sessionId: request.sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке запроса чата: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Упрощенный метод для быстрых текстовых запросов
   */
  async simplePrompt(
    request: SimpleTextRequestDto
  ): Promise<LangChainChatResponseDto> {
    this.logger.debug(`Обработка простого текстового запроса`);

    // Формируем сообщения
    const messages: ChatMessageDto[] = [];

    if (request.systemPrompt) {
      messages.push({
        role: MessageRole.SYSTEM,
        content: request.systemPrompt,
      });
    }

    messages.push({
      role: MessageRole.HUMAN,
      content: request.prompt,
    });

    // Используем основной метод chat
    return this.chat({
      messages,
      model: request.model,
      parameters: request.parameters,
      stream: request.stream,
    });
  }

  /**
   * Потоковая генерация ответа
   */
  async *chatStream(
    request: LangChainChatRequestDto
  ): AsyncGenerator<string, void, unknown> {
    try {
      this.logger.debug(`Начало потоковой генерации`);

      // Создаем модель
      const chatModel = this.createChatModel(request.model, request.parameters);

      // Конвертируем сообщения
      const langchainMessages = request.messages.map((msg) =>
        this.convertToLangChainMessage(msg)
      );

      // Если есть инструменты, привязываем их к модели
      let modelWithTools = chatModel;
      if (request.tools && request.tools.length > 0) {
        modelWithTools = chatModel.bindTools(request.tools);
      }

      // Создаем поток
      const stream = await modelWithTools.stream(langchainMessages);

      // Стримим чанки
      for await (const chunk of stream) {
        // Обрабатываем контент
        if (chunk.content) {
          yield chunk.content as string;
        }

        // Обрабатываем tool calls
        if (chunk.tool_calls) {
          // Передаем tool calls как JSON
          yield JSON.stringify({
            tool_calls: chunk.tool_calls,
            finish_reason: chunk.finish_reason
          });
        }

        // Проверяем finish_reason для завершения
        if (chunk.finish_reason) {
          yield JSON.stringify({
            finish_reason: chunk.finish_reason
          });
        }
      }

      this.logger.debug(`Потоковая генерация завершена`);
    } catch (error) {
      this.logger.error(
        `Ошибка при потоковой генерации: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Метод для работы с цепочками (chains) LangChain
   * Позволяет создавать более сложные сценарии обработки
   */
  async executeChain(
    request: LangChainChatRequestDto
  ): Promise<LangChainChatResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Выполнение цепочки LangChain`);

      // Создаем модель
      const chatModel = this.createChatModel(request.model, request.parameters);

      // Конвертируем сообщения
      const langchainMessages = request.messages.map((msg) =>
        this.convertToLangChainMessage(msg)
      );

      // Выполняем через модель напрямую
      const response = await chatModel.invoke(langchainMessages);

      const endTime = Date.now();
      const generationTime = (endTime - startTime) / 1000;

      this.logger.log(
        `Цепочка выполнена успешно за ${generationTime.toFixed(2)}s`
      );

      return {
        content: response.content as string,
        metadata: {
          model: request.model || this.defaultModel,
          generationTime,
          usage: (response.response_metadata as any)?.tokenUsage
            ? {
                promptTokens: (response.response_metadata as any).tokenUsage
                  .promptTokens,
                completionTokens: (response.response_metadata as any).tokenUsage
                  .completionTokens,
                totalTokens: (response.response_metadata as any).tokenUsage
                  .totalTokens,
              }
            : undefined,
        },
        sessionId: request.sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Ошибка при выполнении цепочки: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Батч-обработка нескольких запросов
   */
  async batchProcess(
    requests: LangChainChatRequestDto[]
  ): Promise<LangChainChatResponseDto[]> {
    this.logger.log(`Начало батч-обработки ${requests.length} запросов`);

    try {
      // Обрабатываем запросы последовательно
      const results: LangChainChatResponseDto[] = [];

      for (const request of requests) {
        const result = await this.chat(request);
        results.push(result);
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Ошибка при батч-обработке: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Получение информации о сервисе
   */
  getServiceInfo() {
    return {
      service: "LangChain OpenRouter Service",
      version: "1.0.0",
      defaultModel: this.defaultModel,
      baseUrl: this.baseUrl,
      status: this.apiKey ? "configured" : "not_configured",
      proxy: {
        configured: !!this.proxyUrl,
        url: this.proxyUrl || null,
        available: this.proxyAvailable,
        status: this.proxyUrl
          ? this.proxyAvailable
            ? "active"
            : "unavailable"
          : "not_configured",
      },
      features: {
        chat: true,
        streaming: true,
        batch: true,
        chains: true,
      },
    };
  }
}
