import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenRouter, OpenRouterStream, types } from "openrouter-client";
import axios from "axios";
import {
  OpenRouterConfigDto,
  OpenRouterMessageDto,
  OpenRouterResponseDto,
  OpenRouterErrorResponseDto,
  GenerationStatsDto,
  ModelsListResponseDto,
  OpenRouterModelDto,
} from "./dto/openrouter.dto";

/**
 * Сервис для работы с OpenRouter API
 * Использует npm-пакет openrouter-client
 */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly httpReferer?: string;
  private readonly xTitle?: string;
  private client: OpenRouter;

  constructor(private configService: ConfigService) {
    const config = this.configService.get("openrouter");

    if (!config?.apiKey) {
      this.logger.warn(
        "OPENROUTER_API_KEY not set in environment variables. OpenRouter service will not function."
      );
    }

    this.apiKey = config?.apiKey || "";
    this.baseUrl = config?.baseUrl || "https://openrouter.ai/api/v1";
    this.defaultModel =
      config?.defaultModel || "meta-llama/llama-3.3-70b-instruct";
    this.httpReferer = config?.httpReferer;
    this.xTitle = config?.xTitle;

    // Инициализируем клиент с глобальной конфигурацией
    this.client = new OpenRouter(this.apiKey, {
      httpReferer: this.httpReferer,
      xTitle: this.xTitle,
    });

    this.logger.log(
      `OpenRouterService initialized with base URL: ${this.baseUrl}, default model: ${this.defaultModel}`
    );
  }

  /**
   * Проверяет наличие API ключа
   */
  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new BadRequestException(
        "OpenRouter API key is not configured. Set OPENROUTER_API_KEY in environment variables."
      );
    }
  }

  /**
   * Преобразует DTO конфигурации в формат openrouter-client
   */
  private prepareConfig(config?: OpenRouterConfigDto): any {
    if (!config) {
      return { model: this.defaultModel };
    }

    const result: any = {};

    // Модель
    if (config.model) {
      result.model = config.model;
    } else {
      result.model = this.defaultModel;
    }

    // Базовые параметры
    if (config.temperature !== undefined)
      result.temperature = config.temperature;
    if (config.min_p !== undefined) result.min_p = config.min_p;
    if (config.max_tokens !== undefined) result.max_tokens = config.max_tokens;
    if (config.top_a !== undefined) result.top_a = config.top_a;
    if (config.top_p !== undefined) result.top_p = config.top_p;
    if (config.top_k !== undefined) result.top_k = config.top_k;
    if (config.frequency_penalty !== undefined)
      result.frequency_penalty = config.frequency_penalty;
    if (config.presence_penalty !== undefined)
      result.presence_penalty = config.presence_penalty;
    if (config.repetition_penalty !== undefined)
      result.repetition_penalty = config.repetition_penalty;
    if (config.stop !== undefined) result.stop = config.stop;

    // Провайдер
    if (config.provider) {
      result.provider = {
        only: config.provider.only,
        order: config.provider.order,
        ignore: config.provider.ignore,
        quantizations: config.provider.quantizations,
        data_collection: config.provider.data_collection,
        allow_fallbacks: config.provider.allow_fallbacks,
        require_parameters: config.provider.require_parameters,
      };
    }

    // Reasoning
    if (config.reasoning) {
      result.reasoning = {
        exclude: config.reasoning.exclude,
        enabled: config.reasoning.enabled,
        ...(config.reasoning.effort && { effort: config.reasoning.effort }),
        ...(config.reasoning.max_tokens && {
          max_tokens: config.reasoning.max_tokens,
        }),
      };
    }

    // Заголовки
    if (config.httpReferer) {
      result.httpReferer = config.httpReferer;
    } else if (this.httpReferer) {
      result.httpReferer = this.httpReferer;
    }

    if (config.xTitle) {
      result.xTitle = config.xTitle;
    } else if (this.xTitle) {
      result.xTitle = this.xTitle;
    }

    return result;
  }

  /**
   * Преобразует DTO сообщений в формат openrouter-client
   */
  private prepareMessages(messages: OpenRouterMessageDto[]): types.Message[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Отправляет chat completion запрос (без стриминга)
   * @param messages Массив сообщений
   * @param config Конфигурация запроса
   * @returns Ответ от OpenRouter
   */
  async chat(
    messages: OpenRouterMessageDto[],
    config?: OpenRouterConfigDto
  ): Promise<OpenRouterResponseDto> {
    this.validateApiKey();

    try {
      const preparedMessages = this.prepareMessages(messages);
      const preparedConfig = this.prepareConfig(config);

      this.logger.debug(
        `Sending chat request with model: ${preparedConfig.model}, messages: ${messages.length}`
      );

      const response = await this.client.chat(preparedMessages, preparedConfig);

      if (!response.success) {
        if ("error" in response) {
          if (response.error === "AbortError") {
            throw new BadRequestException("Request was aborted");
          }

          // Это случай с { success: false, error: unknown }
          throw new BadRequestException(
            `OpenRouter API error: ${JSON.stringify(response.error)}`
          );
        }

        // Это случай с { success: false, errorCode, errorMessage, metadata }
        if ("errorCode" in response && "errorMessage" in response) {
          this.logger.error(
            `OpenRouter API error: ${response.errorCode} - ${response.errorMessage}`,
            response.metadata
          );
          throw new BadRequestException(
            `OpenRouter API error: ${response.errorMessage}`
          );
        }

        // Fallback на случай неизвестной структуры ошибки
        throw new BadRequestException(
          `OpenRouter API error: ${JSON.stringify(response)}`
        );
      }

      this.logger.debug(`Chat response received, ID: ${response.data.id}`);

      return response.data as OpenRouterResponseDto;
    } catch (error) {
      this.logger.error(`Error in chat request: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to send chat request: ${error.message}`
      );
    }
  }

  /**
   * Получает статистику генерации по ID
   * @param id ID генерации
   * @returns Статистика генерации
   */
  async getGenerationStats(id: string): Promise<GenerationStatsDto> {
    this.validateApiKey();

    try {
      this.logger.debug(`Fetching generation stats for ID: ${id}`);
      const stats = await this.client.getGenerationStats(id);
      return stats as GenerationStatsDto;
    } catch (error) {
      this.logger.error(
        `Error fetching generation stats: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to fetch generation stats: ${error.message}`
      );
    }
  }

  /**
   * Получает список всех доступных моделей OpenRouter
   * @returns Список моделей
   */
  async getModels(): Promise<ModelsListResponseDto> {
    try {
      this.logger.debug("Fetching all available models from OpenRouter");

      const response = await axios.get<ModelsListResponseDto>(
        `${this.baseUrl}/models`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      this.logger.debug(
        `Fetched ${response.data.data?.length || 0} models from OpenRouter`
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error fetching models list: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to fetch models list: ${error.message}`
      );
    }
  }

  /**
   * Получает список бесплатных моделей OpenRouter
   * Фильтрует модели, где pricing.prompt === "0" и pricing.completion === "0"
   * @returns Список бесплатных моделей
   */
  async getFreeModels(): Promise<ModelsListResponseDto> {
    try {
      this.logger.debug("Fetching free models from OpenRouter");

      const allModels = await this.getModels();

      // Фильтруем только бесплатные модели
      const freeModels = allModels.data.filter((model) => {
        const isPromptFree =
          model.pricing?.prompt === "0" || model.pricing?.prompt === "0.0";
        const isCompletionFree =
          model.pricing?.completion === "0" ||
          model.pricing?.completion === "0.0";

        return isPromptFree && isCompletionFree;
      });

      this.logger.debug(`Found ${freeModels.length} free models`);

      // Сортируем по имени для удобства
      freeModels.sort((a, b) => a.name.localeCompare(b.name));

      return {
        data: freeModels,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching free models: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to fetch free models: ${error.message}`
      );
    }
  }

  /**
   * Создает стриминговый клиент для chat completions
   * @param messages Массив сообщений
   * @param config Конфигурация запроса
   * @returns Стриминговый клиент с event emitter
   */
  createStreamClient(
    messages: OpenRouterMessageDto[],
    config?: OpenRouterConfigDto
  ): {
    streamClient: OpenRouterStream;
    start: () => Promise<void>;
  } {
    this.validateApiKey();

    const preparedConfig = this.prepareConfig(config);
    const streamClient = new OpenRouterStream(this.apiKey, preparedConfig);

    const preparedMessages = this.prepareMessages(messages);

    const start = async () => {
      this.logger.debug(
        `Starting stream with model: ${preparedConfig.model}, messages: ${messages.length}`
      );
      await streamClient.chatStreamChunk(preparedMessages, preparedConfig);
    };

    return { streamClient, start };
  }

  /**
   * Стриминговый запрос (chunk mode) через async generator
   * Удобно для использования в NestJS контроллерах
   * @param messages Массив сообщений
   * @param config Конфигурация запроса
   * @yields Чанки ответа
   */
  async *chatStreamChunk(
    messages: OpenRouterMessageDto[],
    config?: OpenRouterConfigDto
  ): AsyncGenerator<any, void, unknown> {
    this.validateApiKey();

    const { streamClient, start } = this.createStreamClient(messages, config);

    // Создаем очередь для чанков
    const queue: any[] = [];
    let isComplete = false;
    let streamError: Error | null = null;
    let resolver: ((value: any) => void) | null = null;

    // Настраиваем обработчики событий
    streamClient.on("data", (data) => {
      this.logger.debug(
        `Received stream chunk: ${JSON.stringify(data).substring(0, 100)}`
      );
      queue.push(data);
      if (resolver) {
        const r = resolver;
        resolver = null;
        r(queue.shift());
      }
    });

    streamClient.on("end", () => {
      this.logger.debug("Stream completed");
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    streamClient.on("error", (error) => {
      this.logger.error(`Stream error: ${error.message}`, error);
      streamError = error as Error;
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    // Запускаем стрим
    start().catch((error) => {
      this.logger.error(`Failed to start stream: ${error.message}`, error);
      streamError = error;
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    // Отдаем чанки по мере поступления
    while (!isComplete || queue.length > 0) {
      if (streamError) {
        throw new BadRequestException(`Stream error: ${streamError.message}`);
      }

      if (queue.length > 0) {
        yield queue.shift();
      } else if (!isComplete) {
        // Ждем новые данные
        await new Promise<any>((resolve) => {
          resolver = resolve;
        });
        if (resolver === null && queue.length > 0) {
          yield queue.shift();
        }
      }
    }

    if (streamError) {
      throw new BadRequestException(`Stream error: ${streamError.message}`);
    }
  }

  /**
   * Стриминговый запрос (whole mode) через async generator
   * В этом режиме каждый чанк содержит полное сообщение, обновленное новым контентом
   * @param messages Массив сообщений
   * @param config Конфигурация запроса
   * @yields Полные обновленные ответы
   */
  async *chatStreamWhole(
    messages: OpenRouterMessageDto[],
    config?: OpenRouterConfigDto
  ): AsyncGenerator<any, void, unknown> {
    this.validateApiKey();

    const preparedConfig = this.prepareConfig(config);
    const streamClient = new OpenRouterStream(this.apiKey, preparedConfig);
    const preparedMessages = this.prepareMessages(messages);

    const queue: any[] = [];
    let isComplete = false;
    let streamError: Error | null = null;
    let resolver: ((value: any) => void) | null = null;

    streamClient.on("data", (data) => {
      this.logger.debug(
        `Received whole stream data: ${JSON.stringify(data).substring(0, 100)}`
      );
      queue.push(data);
      if (resolver) {
        const r = resolver;
        resolver = null;
        r(queue.shift());
      }
    });

    streamClient.on("end", () => {
      this.logger.debug("Whole stream completed");
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    streamClient.on("error", (error) => {
      this.logger.error(`Whole stream error: ${error.message}`, error);
      streamError = error as Error;
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    // Запускаем стрим в whole режиме
    streamClient
      .chatStreamWhole(preparedMessages, preparedConfig)
      .catch((error) => {
        this.logger.error(
          `Failed to start whole stream: ${error.message}`,
          error
        );
        streamError = error;
        isComplete = true;
        if (resolver) {
          resolver(null);
        }
      });

    // Отдаем данные по мере поступления
    while (!isComplete || queue.length > 0) {
      if (streamError) {
        throw new BadRequestException(`Stream error: ${streamError.message}`);
      }

      if (queue.length > 0) {
        yield queue.shift();
      } else if (!isComplete) {
        await new Promise<any>((resolve) => {
          resolver = resolve;
        });
        if (resolver === null && queue.length > 0) {
          yield queue.shift();
        }
      }
    }

    if (streamError) {
      throw new BadRequestException(`Stream error: ${streamError.message}`);
    }
  }
}
