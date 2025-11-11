import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Bytez from "bytez.js";
import axios, { AxiosInstance } from "axios";
import {
  BytezModelRunDto,
  BytezModelResponseDto,
  BytezModelInfoDto,
  BytezChatCompletionCreateParamsDto,
  BytezChatCompletionResponseDto,
} from "./dto/bytez.dto";

@Injectable()
export class BytezService {
  private readonly logger = new Logger(BytezService.name);
  private readonly bytezClient: Bytez;
  private readonly bytezApiKey: string;
  private readonly bytezApiBaseUrl =
    "https://api.bytez.com/models/v2/openai/v1";
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    const bytezConfig = this.configService.get("bytez");
    const apiKey = bytezConfig?.apiKey;

    if (!apiKey) {
      this.logger.warn(
        "BYTEZ_API_KEY не установлен в переменных окружения. Некоторые функции могут быть недоступны."
      );
    }

    this.bytezApiKey = apiKey || "";

    // Инициализируем клиент bytez.js для других операций
    this.bytezClient = new Bytez(this.bytezApiKey);

    // Инициализируем axios для OpenAI-совместимого API
    // Согласно документации: https://docs.bytez.com/http-reference/examples/openai-compliant/chatCompletionsExample
    // Authorization header должен содержать только BYTEZ_KEY без "Bearer"
    this.axiosInstance = axios.create({
      baseURL: this.bytezApiBaseUrl,
      timeout: 120000, // 120 секунд таймаут для больших ответов
      headers: {
        "Content-Type": "application/json",
        Authorization: this.bytezApiKey, // Bytez использует просто ключ, без "Bearer"
      },
    });

    // Добавляем interceptor для логирования запросов
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const fullUrl = `${config.baseURL}${config.url}`;
        this.logger.debug(
          `[Bytez API] Request: ${config.method?.toUpperCase()} ${fullUrl}`
        );
        const authHeader = config.headers?.Authorization;
        const authValue =
          typeof authHeader === "string"
            ? authHeader.length > 0
              ? `present (length: ${authHeader.length})`
              : "empty"
            : authHeader
              ? "present (not string)"
              : "missing";
        this.logger.debug(`[Bytez API] Authorization header: ${authValue}`);
        this.logger.debug(
          `[Bytez API] All headers: ${JSON.stringify(config.headers)}`
        );
        this.logger.debug(
          `[Bytez API] Body: ${JSON.stringify(config.data)?.substring(0, 500)}`
        );
        return config;
      },
      (error) => {
        this.logger.error(`[Bytez API] Request error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Добавляем interceptor для логирования ответов
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `[Bytez API] Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `[Bytez API] Response error: ${error.response?.status} ${error.config?.url} - ${error.message}`
        );
        if (error.response) {
          this.logger.error(
            `[Bytez API] Error response data: ${JSON.stringify(error.response.data)}`
          );
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Получает модель по ID
   * @param modelId ID модели
   * @returns Объект модели bytez.js
   */
  getModel(modelId: string): any {
    if (!modelId) {
      throw new BadRequestException("Model ID is required");
    }
    return this.bytezClient.model(modelId);
  }

  /**
   * Запускает модель с входными данными
   * @param data Данные для запуска модели
   * @returns Результат выполнения модели
   */
  async runModel(data: BytezModelRunDto): Promise<BytezModelResponseDto> {
    try {
      this.logger.debug(
        `Running model ${data.modelId} with input: ${JSON.stringify(data.input).substring(0, 200)}`
      );

      const model = this.getModel(data.modelId);
      const result: any = await model.run({
        input: data.input,
        ...data.options,
      });

      this.logger.debug(`Model ${data.modelId} completed successfully`);

      return {
        output: result.output,
        error: result.error,
        metadata: (result as any).metadata || {},
      };
    } catch (error: any) {
      this.logger.error(
        `Error running model ${data.modelId}: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to run model: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Получает информацию о модели
   * @param modelId ID модели
   * @returns Информация о модели
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      this.logger.debug(`Getting info for model ${modelId}`);
      const model = this.getModel(modelId);

      // bytez.js может иметь метод для получения информации о модели
      // Если такого метода нет, возвращаем базовую информацию
      return {
        modelId,
        available: true,
      };
    } catch (error: any) {
      this.logger.error(
        `Error getting model info for ${modelId}: ${error.message}`
      );
      throw new BadRequestException(
        `Failed to get model info: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Получает список доступных моделей (если поддерживается API)
   * @param query Поисковый запрос (опционально)
   * @param limit Лимит результатов (опционально)
   * @returns Список моделей
   */
  async listModels(query?: string, limit?: number): Promise<any> {
    try {
      this.logger.debug(`Listing models with query: ${query}, limit: ${limit}`);

      // bytez.js может иметь метод для получения списка моделей
      // Если такого метода нет, возвращаем пустой массив или базовую информацию
      // В реальной реализации здесь должен быть вызов API bytez для получения списка моделей

      return {
        models: [],
        total: 0,
        message:
          "Model listing is not directly supported. Use model ID from bytez.com/model-hub",
      };
    } catch (error: any) {
      this.logger.error(`Error listing models: ${error.message}`);
      throw new BadRequestException(
        `Failed to list models: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Проверяет доступность API ключа
   * @returns true если API ключ установлен
   */
  isApiKeyConfigured(): boolean {
    const bytezConfig = this.configService.get("bytez");
    return !!bytezConfig?.apiKey;
  }

  /**
   * Получает список доступных моделей для чата
   * Список основан на моделях, поддерживаемых через OpenAI-совместимый API bytez
   * Документация: https://docs.bytez.com/http-reference/examples/openai-compliant/chatCompletionsExample
   * @returns Список моделей чата
   */
  async listChatModels(): Promise<{
    models: Array<{ id: string; name: string; description?: string }>;
    total: number;
  }> {
    this.logger.debug("listChatModels called");
    // Список популярных open source моделей чата через bytez
    // Для закрытых моделей (openai, anthropic, mistral, google, cohere) нужен provider-key
    const chatModels = [
      // Meta Llama модели
      {
        id: "meta-llama/Llama-3.1-8B-Instruct",
        name: "Llama 3.1 8B Instruct",
        description: "Meta Llama 3.1 8B Instruct - мощная модель для диалогов",
      },
      {
        id: "meta-llama/Llama-3.1-70B-Instruct",
        name: "Llama 3.1 70B Instruct",
        description:
          "Meta Llama 3.1 70B Instruct - продвинутая модель для диалогов",
      },
      // Mistral модели
      {
        id: "mistralai/Mistral-7B-Instruct-v0.2",
        name: "Mistral 7B Instruct",
        description: "Mistral 7B Instruct - быстрая и эффективная модель",
      },
      {
        id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        name: "Mixtral 8x7B Instruct",
        description: "Mixtral 8x7B Instruct - смешанная модель экспертов",
      },
      // Google модели
      {
        id: "google/gemma-7b-it",
        name: "Gemma 7B IT",
        description:
          "Google Gemma 7B Instruction Tuned - легкая модель от Google",
      },
      // Qwen модели
      {
        id: "Qwen/Qwen2.5-7B-Instruct",
        name: "Qwen 2.5 7B Instruct",
        description: "Qwen 2.5 7B Instruct - многоязычная модель",
      },
      {
        id: "Qwen/Qwen3-4B",
        name: "Qwen 3 4B",
        description: "Qwen 3 4B - компактная многоязычная модель",
      },
      // Microsoft модели
      {
        id: "microsoft/Phi-3-mini-4k-instruct",
        name: "Phi-3 Mini 4K Instruct",
        description: "Microsoft Phi-3 Mini - компактная модель",
      },
      // Дополнительные популярные модели
      {
        id: "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
        name: "Nous Hermes 2 Mixtral",
        description: "Nous Hermes 2 - fine-tuned модель на Mixtral",
      },
      {
        id: "teknium/OpenHermes-2.5-Mistral-7B",
        name: "OpenHermes 2.5 Mistral",
        description: "OpenHermes 2.5 - открытая модель для диалогов",
      },
    ];

    this.logger.debug(`Returning ${chatModels.length} chat models`);
    const result = {
      models: chatModels,
      total: chatModels.length,
    };
    this.logger.debug(`Result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Создает chat completion через bytez используя OpenAI-совместимый API
   * Согласно документации: https://docs.bytez.com/http-reference/examples/openai-compliant/chatCompletionsExample
   * @param data Параметры для chat completion
   * @returns Ответ модели
   */
  async chatCompletions(
    data: BytezChatCompletionCreateParamsDto
  ): Promise<BytezChatCompletionResponseDto> {
    try {
      // Проверяем наличие API ключа
      if (!this.bytezApiKey) {
        throw new BadRequestException(
          "BYTEZ_API_KEY не установлен. Установите переменную окружения BYTEZ_API_KEY."
        );
      }

      this.logger.debug(
        `Chat completion request for model ${data.modelId} with ${data.messages.length} messages`
      );

      // Используем OpenAI-совместимый API bytez
      // Формат запроса полностью совместим с OpenAI
      // Согласно документации: https://docs.bytez.com/http-reference/examples/openai-compliant/chatCompletionsExample
      const requestBody: any = {
        model: data.modelId,
        messages: data.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: data.temperature || 0.7,
        stream: false, // Для обычного запроса без стриминга
      };

      // Добавляем max_tokens только если он указан
      if (data.maxTokens) {
        requestBody.max_tokens = data.maxTokens;
      }

      this.logger.debug(
        `[Bytez API] Request URL: ${this.bytezApiBaseUrl}/chat/completions`
      );
      this.logger.debug(
        `[Bytez API] Request body: ${JSON.stringify(requestBody)}`
      );

      const response = await this.axiosInstance.post(
        "/chat/completions",
        requestBody
      );

      this.logger.debug(`Chat completion completed for model ${data.modelId}`);

      // Извлекаем ответ из OpenAI-совместимого формата
      const choice = response.data.choices?.[0];
      const output = choice?.message?.content || "";

      return {
        output,
        error: response.data.error,
        metadata: {
          id: response.data.id,
          model: response.data.model,
          usage: response.data.usage,
          finish_reason: choice?.finish_reason,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Error in chat completion for model ${data.modelId}: ${error.message}`,
        error.stack
      );

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        "Unknown error";

      throw new BadRequestException(
        `Failed to get chat completion: ${errorMessage}`
      );
    }
  }

  /**
   * Получает стрим для chat completion через bytez
   * @param data Параметры для chat completion
   * @returns Node.js stream для прямого проксирования
   */
  async getChatCompletionsStream(
    data: BytezChatCompletionCreateParamsDto
  ): Promise<NodeJS.ReadableStream> {
    try {
      // Проверяем наличие API ключа
      if (!this.bytezApiKey) {
        throw new BadRequestException(
          "BYTEZ_API_KEY не установлен. Установите переменную окружения BYTEZ_API_KEY."
        );
      }

      this.logger.debug(
        `[Bytez Stream] Preparing stream request for model ${data.modelId}`
      );

      // Используем OpenAI-совместимый API bytez
      // Согласно документации: https://docs.bytez.com/http-reference/examples/openai-compliant/chatCompletionsExample
      const requestBody: any = {
        model: data.modelId,
        messages: data.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: data.temperature || 0.7,
        stream: true,
      };

      // Добавляем max_tokens только если он указан
      if (data.maxTokens) {
        requestBody.max_tokens = data.maxTokens;
      }

      this.logger.debug(
        `[Bytez Stream] Request URL: ${this.bytezApiBaseUrl}/chat/completions`
      );
      this.logger.debug(
        `[Bytez Stream] Request body: ${JSON.stringify(requestBody)}`
      );
      this.logger.debug(
        `[Bytez Stream] Authorization header: ${this.bytezApiKey ? "present" : "missing"}`
      );

      const response = await this.axiosInstance.post(
        "/chat/completions",
        requestBody,
        {
          responseType: "stream",
        }
      );

      this.logger.debug(
        `[Bytez Stream] Response received, status: ${response.status}`
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `[Bytez Stream] Error creating stream: ${error.message}`,
        error.stack
      );
      if (error.response) {
        this.logger.error(
          `[Bytez Stream] Error response status: ${error.response.status}`
        );
        this.logger.error(
          `[Bytez Stream] Error response data: ${JSON.stringify(error.response.data)}`
        );
        this.logger.error(
          `[Bytez Stream] Error response headers: ${JSON.stringify(error.response.headers)}`
        );
      }
      throw error;
    }
  }
}
