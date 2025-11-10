import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  AgentCallDto,
  AgentCallResponseDto,
  ChatCompletionCreateParamsDto,
  OpenAiChatCompletionResponseDto,
  OpenAiTextCompletionRequestDto,
  OpenAiTextCompletionResponseDto,
  OpenAiModelsResponseDto,
} from "./dto/cloud-ai.dto";

@Injectable()
export class CloudAiService {
  private readonly logger = new Logger(CloudAiService.name);
  private readonly baseUrl: string;
  private readonly defaultAgentAccessId?: string;
  private readonly defaultAuthToken?: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    const cloudAiConfig = this.configService.get("cloudAi");
    this.baseUrl = cloudAiConfig?.baseUrl || "https://agent.timeweb.cloud";
    this.defaultAgentAccessId = cloudAiConfig?.defaultAgentAccessId;
    this.defaultAuthToken = cloudAiConfig?.defaultAuthToken;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 секунд таймаут
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Добавляем interceptor для логирования запросов
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        this.logger.error(`Request error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Добавляем interceptor для логирования ответов
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `Response error: ${error.response?.status} ${error.config?.url} - ${error.message}`
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Получает agentAccessId из параметра или конфигурации
   */
  private getAgentAccessId(agentAccessId?: string): string {
    const id = agentAccessId || this.defaultAgentAccessId;
    if (!id) {
      throw new BadRequestException(
        "Agent access ID is required. Provide it as parameter or set CLOUD_AI_AGENT_ACCESS_ID in environment variables."
      );
    }
    return id;
  }

  /**
   * Получает authToken из параметра или конфигурации
   */
  private getAuthToken(authToken?: string): string | undefined {
    return authToken || this.defaultAuthToken;
  }

  /**
   * Формирует заголовки для запроса с опциональной авторизацией
   */
  private getHeaders(authToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.getAuthToken(authToken);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Вызывает AI агента с простым сообщением
   * @param data Данные для вызова агента
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @returns Ответ от агента
   */
  async callAgent(
    data: AgentCallDto,
    agentAccessId?: string,
    authToken?: string
  ): Promise<AgentCallResponseDto> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/call`;
      const response = await this.axiosInstance.post<AgentCallResponseDto>(
        url,
        data,
        {
          headers: this.getHeaders(authToken),
        }
      );

      return response.data;
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error calling agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to call agent: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * OpenAI-совместимый эндпоинт для chat completions
   * Поддерживает простые текстовые сообщения и мультимодальный контент
   * @param data Параметры для chat completion
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @returns Ответ с завершением чата
   */
  async chatCompletions(
    data: ChatCompletionCreateParamsDto,
    agentAccessId?: string,
    authToken?: string
  ): Promise<OpenAiChatCompletionResponseDto> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/v1/chat/completions`;
      const response =
        await this.axiosInstance.post<OpenAiChatCompletionResponseDto>(
          url,
          data,
          {
            headers: this.getHeaders(authToken),
          }
        );

      return response.data;
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error in chat completions for agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to get chat completion: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * OpenAI-совместимый эндпоинт для text completions (legacy, deprecated)
   * @param data Параметры для text completion
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @returns Ответ с текстовым завершением
   */
  async textCompletions(
    data: OpenAiTextCompletionRequestDto,
    agentAccessId?: string,
    authToken?: string
  ): Promise<OpenAiTextCompletionResponseDto> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/v1/completions`;
      const response =
        await this.axiosInstance.post<OpenAiTextCompletionResponseDto>(
          url,
          data,
          {
            headers: this.getHeaders(authToken),
          }
        );

      return response.data;
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error in text completions for agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to get text completion: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * OpenAI-совместимый эндпоинт для получения списка доступных моделей
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @returns Список доступных моделей
   */
  async getModels(
    agentAccessId?: string,
    authToken?: string
  ): Promise<OpenAiModelsResponseDto> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/v1/models`;
      const response = await this.axiosInstance.get<OpenAiModelsResponseDto>(
        url,
        {
          headers: this.getHeaders(authToken),
        }
      );

      return response.data;
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error getting models for agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to get models: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Получает embed код для встраивания виджета агента
   * @param options Опции для embed кода
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @returns JavaScript код для встраивания
   */
  async getAgentEmbedCode(
    options: {
      collapsed?: boolean;
      referer?: string;
      origin?: string;
    } = {},
    agentAccessId?: string,
    authToken?: string
  ): Promise<string> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/embed.js`;
      const headers = this.getHeaders(authToken);

      // Добавляем заголовки referer и origin, если они указаны
      if (options.referer) {
        headers["referer"] = options.referer;
      }
      if (options.origin) {
        headers["origin"] = options.origin;
      }

      const params: Record<string, any> = {};
      if (options.collapsed !== undefined) {
        params.collapsed = options.collapsed;
      }

      const response = await this.axiosInstance.get<string>(url, {
        headers,
        params,
        responseType: "text",
      });

      return response.data;
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error getting embed code for agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to get embed code: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Стриминговая версия chat completions
   * Возвращает async generator для обработки стриминговых ответов
   * @param data Параметры для chat completion
   * @param agentAccessId ID доступа к агенту (опционально, можно установить через CLOUD_AI_AGENT_ACCESS_ID)
   * @param authToken Опциональный токен авторизации (можно установить через CLOUD_AI_DEFAULT_AUTH_TOKEN)
   * @yields Части ответа из стрима
   */
  async *chatCompletionsStream(
    data: ChatCompletionCreateParamsDto,
    agentAccessId?: string,
    authToken?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const id = this.getAgentAccessId(agentAccessId);
      const url = `/api/v1/cloud-ai/agents/${id}/v1/chat/completions`;

      // Убеждаемся, что stream включен
      const streamData = { ...data, stream: true };

      const response = await this.axiosInstance.post(url, streamData, {
        headers: this.getHeaders(authToken),
        responseType: "stream",
      });

      // Обрабатываем стрим
      for await (const chunk of response.data) {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield JSON.stringify(parsed);
            } catch (e) {
              // Игнорируем ошибки парсинга отдельных чанков
            }
          }
        }
      }
    } catch (error) {
      const id = agentAccessId || this.defaultAgentAccessId || "unknown";
      this.logger.error(
        `Error in streaming chat completions for agent ${id}: ${error.message}`,
        error.response?.data
      );
      throw new BadRequestException(
        `Failed to stream chat completion: ${error.response?.data?.message || error.message}`
      );
    }
  }
}
