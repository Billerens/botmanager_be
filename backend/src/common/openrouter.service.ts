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
  private readonly allowedModels: string[];
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
    this.allowedModels = config?.allowedModels || [];

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

          // Пытаемся извлечь более детальное сообщение из metadata
          let detailedMessage = response.errorMessage;

          if (response.metadata) {
            const metadata = response.metadata as any;

            // Если есть raw данные, пытаемся извлечь сообщение из HTML
            if (metadata.raw) {
              try {
                const rawStr = String(metadata.raw);
                // Ищем сообщение в HTML (например, "This service is not available in your region")
                const match = rawStr.match(/<p[^>]*>([^<]+)<\/p>/i);
                if (match && match[1]) {
                  detailedMessage = match[1].trim();
                } else if (rawStr.includes("not available in your region")) {
                  detailedMessage =
                    "This service is not available in your region";
                } else if (rawStr.includes("region")) {
                  detailedMessage = "Service is not available in your region";
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }

            // Добавляем информацию о провайдере, если есть
            if (metadata.provider_name) {
              detailedMessage += ` (Provider: ${metadata.provider_name})`;
            }
          }

          throw new BadRequestException(detailedMessage);
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

      // Пытаемся извлечь более понятное сообщение об ошибке
      let errorMessage = error.message;

      // Если ошибка содержит информацию о регионе или провайдере
      if (
        errorMessage.includes("region") ||
        errorMessage.includes("not available")
      ) {
        errorMessage = errorMessage;
      } else if (errorMessage.includes("Provider returned error")) {
        // Пытаемся найти более детальную информацию
        const errorStr = String(error);
        if (errorStr.includes("not available in your region")) {
          errorMessage = "This service is not available in your region";
        }
      }

      throw new BadRequestException(
        errorMessage || `Failed to send chat request: ${error.message}`
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
   * Получает список платных моделей OpenRouter
   * Если OPENROUTER_ALLOWED_MODELS не задан или пуст, возвращает все модели
   * Иначе фильтрует модели по списку из OPENROUTER_ALLOWED_MODELS
   * @returns Список платных моделей (все или из разрешенного списка)
   */
  async getPaidModels(): Promise<ModelsListResponseDto> {
    try {
      this.logger.debug("Fetching paid models from OpenRouter");

      const allModels = await this.getModels();

      // Если список разрешенных моделей не задан или пуст, возвращаем все модели
      if (!this.allowedModels || this.allowedModels.length === 0) {
        this.logger.debug(
          "OPENROUTER_ALLOWED_MODELS is not configured. Returning all models."
        );

        // Сортируем по имени для удобства
        const sortedModels = [...allModels.data].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        return {
          data: sortedModels,
        };
      }

      // Фильтруем модели по списку разрешенных
      const paidModels = allModels.data.filter((model) => {
        // Проверяем, есть ли модель в списке разрешенных
        // Модель может быть указана как полный ID или как префикс
        return this.allowedModels.some((allowedModel) => {
          // Точное совпадение
          if (model.id === allowedModel) {
            return true;
          }
          // Совпадение по префиксу (например, "meta-llama/" совпадет с "meta-llama/llama-3.3-70b-instruct")
          if (model.id.startsWith(allowedModel)) {
            return true;
          }
          return false;
        });
      });

      this.logger.debug(
        `Found ${paidModels.length} paid models from ${this.allowedModels.length} allowed models`
      );

      // Сортируем по имени для удобства
      paidModels.sort((a, b) => a.name.localeCompare(b.name));

      return {
        data: paidModels,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching paid models: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to fetch paid models: ${error.message}`
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
      let errorMessage = error.message;

      // Пытаемся извлечь более детальную информацию из ошибки
      try {
        // Если ошибка содержит JSON, парсим его
        if (errorMessage.includes("{")) {
          const jsonMatch = errorMessage.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;

              // Пытаемся извлечь сообщение из metadata.raw (HTML)
              if (errorData.error.metadata?.raw) {
                try {
                  const rawStr = String(errorData.error.metadata.raw);
                  // Ищем сообщение в HTML (например, "This service is not available in your region")
                  const match = rawStr.match(/<p[^>]*>([^<]+)<\/p>/i);
                  if (match && match[1]) {
                    errorMessage = match[1].trim();
                  } else if (rawStr.includes("not available in your region")) {
                    errorMessage =
                      "This service is not available in your region";
                  } else if (rawStr.includes("region")) {
                    errorMessage = "Service is not available in your region";
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга raw данных
                }
              }

              // Добавляем информацию о провайдере, если есть
              if (errorData.error.metadata?.provider_name) {
                errorMessage += ` (Provider: ${errorData.error.metadata.provider_name})`;
              }
            }
          }
        }
      } catch (e) {
        // Если не удалось распарсить, используем оригинальное сообщение
        this.logger.warn("Failed to parse error message", e);
      }

      this.logger.error(`Stream error: ${errorMessage}`, error);
      streamError = new Error(errorMessage);
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    // Запускаем стрим
    start().catch((error) => {
      let errorMessage = error.message;

      // Пытаемся извлечь более детальную информацию из ошибки
      try {
        if (errorMessage.includes("{")) {
          const jsonMatch = errorMessage.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;

              // Пытаемся извлечь сообщение из metadata.raw (HTML)
              if (errorData.error.metadata?.raw) {
                try {
                  const rawStr = String(errorData.error.metadata.raw);
                  // Ищем сообщение в HTML (например, "This service is not available in your region")
                  const match = rawStr.match(/<p[^>]*>([^<]+)<\/p>/i);
                  if (match && match[1]) {
                    errorMessage = match[1].trim();
                  } else if (rawStr.includes("not available in your region")) {
                    errorMessage =
                      "This service is not available in your region";
                  } else if (rawStr.includes("region")) {
                    errorMessage = "Service is not available in your region";
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга raw данных
                }
              }

              if (errorData.error.metadata?.provider_name) {
                errorMessage += ` (Provider: ${errorData.error.metadata.provider_name})`;
              }
            }
          }
        }
      } catch (e) {
        this.logger.warn("Failed to parse error message in start()", e);
      }

      this.logger.error(`Failed to start stream: ${errorMessage}`, error);
      streamError = new Error(errorMessage);
      isComplete = true;
      if (resolver) {
        resolver(null);
      }
    });

    // Отдаем чанки по мере поступления
    while (!isComplete || queue.length > 0) {
      if (streamError) {
        // Формируем более информативное сообщение об ошибке
        let errorMessage = streamError.message;

        // Если ошибка связана с моделью, добавляем подсказку
        if (
          errorMessage.includes("model not found") ||
          errorMessage.includes("404")
        ) {
          errorMessage = `Модель недоступна или не найдена. ${errorMessage}. Попробуйте выбрать другую модель.`;
        }

        throw new BadRequestException(errorMessage);
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
      // Формируем более информативное сообщение об ошибке
      let errorMessage = streamError.message;

      // Если ошибка связана с моделью, добавляем подсказку
      if (
        errorMessage.includes("model not found") ||
        errorMessage.includes("404")
      ) {
        errorMessage = `Модель недоступна или не найдена. ${errorMessage}. Попробуйте выбрать другую модель.`;
      }

      throw new BadRequestException(errorMessage);
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
        let errorMessage = error.message;

        // Пытаемся извлечь более детальную информацию из ошибки
        try {
          if (errorMessage.includes("{")) {
            const jsonMatch = errorMessage.match(/\{.*\}/);
            if (jsonMatch) {
              const errorData = JSON.parse(jsonMatch[0]);
              if (errorData.error?.message) {
                errorMessage = errorData.error.message;
                if (errorData.error.metadata?.provider_name) {
                  errorMessage += ` (Provider: ${errorData.error.metadata.provider_name})`;
                }
                if (errorData.error.metadata?.raw) {
                  try {
                    const rawData = JSON.parse(errorData.error.metadata.raw);
                    if (rawData.detail) {
                      errorMessage += ` - ${rawData.detail}`;
                    }
                  } catch (e) {
                    // Игнорируем ошибки парсинга
                  }
                }
              }
            }
          }
        } catch (e) {
          this.logger.warn(
            "Failed to parse error message in chatStreamWhole",
            e
          );
        }

        this.logger.error(
          `Failed to start whole stream: ${errorMessage}`,
          error
        );
        streamError = new Error(errorMessage);
        isComplete = true;
        if (resolver) {
          resolver(null);
        }
      });

    // Отдаем данные по мере поступления
    while (!isComplete || queue.length > 0) {
      if (streamError) {
        // Формируем более информативное сообщение об ошибке
        let errorMessage = streamError.message;

        // Если ошибка связана с моделью, добавляем подсказку
        if (
          errorMessage.includes("model not found") ||
          errorMessage.includes("404")
        ) {
          errorMessage = `Модель недоступна или не найдена. ${errorMessage}. Попробуйте выбрать другую модель.`;
        }

        throw new BadRequestException(errorMessage);
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
      // Формируем более информативное сообщение об ошибке
      let errorMessage = streamError.message;

      // Если ошибка связана с моделью, добавляем подсказку
      if (
        errorMessage.includes("model not found") ||
        errorMessage.includes("404")
      ) {
        errorMessage = `Модель недоступна или не найдена. ${errorMessage}. Попробуйте выбрать другую модель.`;
      }

      throw new BadRequestException(errorMessage);
    }
  }
}
