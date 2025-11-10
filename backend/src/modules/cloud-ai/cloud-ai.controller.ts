import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  Param,
  Res,
  Req,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { CloudAiService } from "../../common/cloud-ai.service";
import {
  AgentCallDto,
  AgentCallResponseDto,
  ChatCompletionCreateParamsDto,
  OpenAiChatCompletionResponseDto,
  OpenAiTextCompletionRequestDto,
  OpenAiTextCompletionResponseDto,
  OpenAiModelsResponseDto,
} from "../../common/dto/cloud-ai.dto";

/**
 * Прокси-контроллер для Cloud AI API
 * Реализует все эндпоинты из api-1.json как прокси
 * Использует дефолтный agentAccessId и authToken из конфигурации
 */
@ApiTags("ai-agents-client")
@Controller("api/v1/cloud-ai")
export class CloudAiController {
  private readonly logger = new Logger(CloudAiController.name);

  constructor(private readonly cloudAiService: CloudAiService) {}

  /**
   * Прокси для POST /api/v1/cloud-ai/agents/{agent_access_id}/call
   * Игнорирует agent_access_id из пути, использует дефолтный из конфигурации
   */
  @Post("agents/:agent_access_id/call")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Call AI agent",
    description:
      "Использует дефолтный agentAccessId из конфигурации (параметр agent_access_id игнорируется)",
  })
  @ApiParam({
    name: "agent_access_id",
    description:
      "Agent access ID (игнорируется, используется дефолтный из конфигурации)",
  })
  @ApiResponse({
    status: 200,
    description: "Agent call response",
    type: AgentCallResponseDto,
  })
  async callAgent(
    @Param("agent_access_id") agentAccessId: string,
    @Body() data: AgentCallDto,
    @Headers("authorization") authToken?: string
  ): Promise<AgentCallResponseDto> {
    this.logger.debug("Call agent request received");

    // Игнорируем agentAccessId из пути, используем дефолтный
    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN
    // Не передаем userToken - сервис будет использовать дефолтный токен из конфигурации
    return await this.cloudAiService.callAgent(data, undefined, undefined);
  }

  /**
   * Прокси для POST /api/v1/cloud-ai/agents/{agent_access_id}/v1/chat/completions
   * Игнорирует agent_access_id из пути, использует дефолтный из конфигурации
   */
  @Post("agents/:agent_access_id/v1/chat/completions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "OpenAI-compatible chat completions endpoint for AI agent",
    description:
      "Использует дефолтный agentAccessId из конфигурации (параметр agent_access_id игнорируется). Поддерживает простые текстовые сообщения и мультимодальный контент.",
  })
  @ApiParam({
    name: "agent_access_id",
    description:
      "Agent access ID (игнорируется, используется дефолтный из конфигурации)",
  })
  @ApiResponse({
    status: 200,
    description: "Chat completion response",
    type: OpenAiChatCompletionResponseDto,
  })
  async chatCompletions(
    @Param("agent_access_id") agentAccessId: string,
    @Body() data: ChatCompletionCreateParamsDto,
    @Headers("authorization") authToken?: string
  ): Promise<OpenAiChatCompletionResponseDto> {
    this.logger.debug("Chat completions request received");

    // Игнорируем agentAccessId из пути, используем дефолтный
    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN
    // Не передаем userToken - сервис будет использовать дефолтный токен из конфигурации
    return await this.cloudAiService.chatCompletions(
      data,
      undefined,
      undefined
    );
  }

  /**
   * Прокси для POST /api/v1/cloud-ai/agents/{agent_access_id}/v1/completions (deprecated)
   * Игнорирует agent_access_id из пути, использует дефолтный из конфигурации
   */
  @Post("agents/:agent_access_id/v1/completions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "OpenAI-compatible text completions endpoint for AI agent (legacy)",
    deprecated: true,
    description:
      "Использует дефолтный agentAccessId из конфигурации (параметр agent_access_id игнорируется). Этот эндпоинт устарел.",
  })
  @ApiParam({
    name: "agent_access_id",
    description:
      "Agent access ID (игнорируется, используется дефолтный из конфигурации)",
  })
  @ApiResponse({
    status: 200,
    description: "Text completion response",
    type: OpenAiTextCompletionResponseDto,
  })
  async textCompletions(
    @Param("agent_access_id") agentAccessId: string,
    @Body() data: OpenAiTextCompletionRequestDto,
    @Headers("authorization") authToken?: string
  ): Promise<OpenAiTextCompletionResponseDto> {
    this.logger.debug("Text completions request received (deprecated)");

    // Игнорируем agentAccessId из пути, используем дефолтный
    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN
    // Не передаем userToken - сервис будет использовать дефолтный токен из конфигурации
    return await this.cloudAiService.textCompletions(
      data,
      undefined,
      undefined
    );
  }

  /**
   * Прокси для GET /api/v1/cloud-ai/agents/{agent_access_id}/v1/models
   * Игнорирует agent_access_id из пути, использует дефолтный из конфигурации
   */
  @Get("agents/:agent_access_id/v1/models")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "OpenAI-compatible models endpoint for AI agent",
    description:
      "Использует дефолтный agentAccessId из конфигурации (параметр agent_access_id игнорируется)",
  })
  @ApiParam({
    name: "agent_access_id",
    description:
      "Agent access ID (игнорируется, используется дефолтный из конфигурации)",
  })
  @ApiResponse({
    status: 200,
    description: "List of available models",
    type: OpenAiModelsResponseDto,
  })
  async getModels(
    @Param("agent_access_id") agentAccessId: string,
    @Headers("authorization") authToken?: string
  ): Promise<OpenAiModelsResponseDto> {
    this.logger.debug("Get models request received");

    // Игнорируем agentAccessId из пути, используем дефолтный
    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN
    // Не передаем userToken - сервис будет использовать дефолтный токен из конфигурации
    return await this.cloudAiService.getModels(undefined, undefined);
  }

  /**
   * Прокси для GET /api/v1/cloud-ai/agents/{agent_access_id}/embed.js
   * Игнорирует agent_access_id из пути, использует дефолтный из конфигурации
   */
  @Get("agents/:agent_access_id/embed.js")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get agent embed code",
    description:
      "Использует дефолтный agentAccessId из конфигурации (параметр agent_access_id игнорируется)",
  })
  @ApiParam({
    name: "agent_access_id",
    description:
      "Agent access ID (игнорируется, используется дефолтный из конфигурации)",
  })
  @ApiQuery({
    name: "collapsed",
    required: false,
    type: Boolean,
    description: "Start widget in collapsed mode (default: true)",
  })
  @ApiResponse({
    status: 200,
    description: "JavaScript embed code",
    type: String,
  })
  async getAgentEmbedCode(
    @Param("agent_access_id") agentAccessId: string,
    @Query("collapsed") collapsed?: boolean,
    @Headers("referer") referer?: string,
    @Headers("origin") origin?: string,
    @Headers("authorization") authToken?: string
  ): Promise<string> {
    this.logger.debug("Get agent embed code request received");

    // Игнорируем agentAccessId из пути, используем дефолтный
    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN
    // Не передаем userToken - сервис будет использовать дефолтный токен из конфигурации
    return await this.cloudAiService.getAgentEmbedCode(
      {
        collapsed,
        referer,
        origin,
      },
      undefined,
      undefined // Всегда используем дефолтный токен из конфигурации
    );
  }

  /**
   * Упрощенный эндпоинт без agent_access_id в пути для удобства фронтенда
   * POST /api/v1/cloud-ai/v1/chat/completions
   * Поддерживает как обычные, так и стриминговые запросы
   */
  @Post("v1/chat/completions")
  @ApiOperation({
    summary: "OpenAI-compatible chat completions endpoint",
    description:
      "Использует дефолтный agentAccessId и authToken из конфигурации бэкенда. Поддерживает стриминг (если stream: true в запросе).",
  })
  @ApiResponse({
    status: 200,
    description: "Chat completion response (обычный или стриминговый)",
  })
  async chatCompletionsSimple(
    @Body() data: ChatCompletionCreateParamsDto,
    @Res() res: Response,
    @Headers("authorization") authToken?: string,
    @Req() req?: Request
  ): Promise<void | OpenAiChatCompletionResponseDto> {
    this.logger.debug("Chat completions request received (simple endpoint)");

    // Логирование входящих данных для диагностики
    this.logger.debug(`Request body type: ${typeof req?.body}`);
    this.logger.debug(`Request body: ${JSON.stringify(req?.body)}`);
    this.logger.debug(`Messages type: ${typeof data?.messages}`);
    this.logger.debug(`Messages is array: ${Array.isArray(data?.messages)}`);
    this.logger.debug(`Messages value: ${JSON.stringify(data?.messages)}`);

    // Токен из заголовка используется только для проверки авторизации на нашем бэкенде
    // Для запросов к внешнему AI-агенту всегда используется CLOUD_AI_DEFAULT_AUTH_TOKEN из конфигурации
    const userToken = authToken?.replace("Bearer ", "") || undefined;
    this.logger.debug(
      `User auth token from header: ${userToken ? "present" : "missing"}`
    );

    // TODO: Здесь можно добавить проверку авторизации пользователя, если нужно
    // if (!userToken) {
    //   throw new UnauthorizedException("User must be authenticated");
    // }

    // Если запрос стриминговый, проксируем стрим
    if (data.stream) {
      this.logger.debug("Starting streaming response");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Отключаем буферизацию в nginx
      res.status(HttpStatus.OK);
      // Принудительно отправляем заголовки немедленно
      res.flushHeaders();

      try {
        // Проксируем стрим напрямую для сохранения оригинальной скорости отправки данных
        const upstreamStream =
          await this.cloudAiService.getChatCompletionsStream(
            data,
            undefined,
            undefined // Всегда используем дефолтный токен из конфигурации
          );

        // Проксируем стрим напрямую, без парсинга и пересборки
        // Это сохраняет оригинальную скорость отправки данных от внешнего API
        upstreamStream.on("data", (chunk: Buffer) => {
          this.logger.debug(
            `Proxying chunk (${chunk.length} bytes) directly to client`
          );
          res.write(chunk);
          // Принудительно отправляем данные немедленно, без буферизации
          // flush() доступен в Node.js ServerResponse, но TypeScript может не знать об этом
          if ("flush" in res && typeof (res as any).flush === "function") {
            (res as any).flush();
          }
        });

        // Ждем завершения стрима
        await new Promise<void>((resolve, reject) => {
          upstreamStream.on("end", () => {
            this.logger.debug("Upstream stream ended, closing response");
            res.end();
            resolve();
          });

          upstreamStream.on("error", (error: Error) => {
            this.logger.error(`Stream error: ${error.message}`, error);
            if (!res.headersSent) {
              res.status(500).json({
                error: {
                  message: error.message || "Failed to stream chat completion",
                },
              });
            } else {
              res.end();
            }
            reject(error);
          });
        });

        this.logger.debug("Stream response ended");
        return; // Не возвращаем значение для стриминговых запросов
      } catch (error: any) {
        this.logger.error(
          `Error in streaming chat completions: ${error.message}`,
          error
        );
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: error.message || "Failed to stream chat completion",
            },
          });
        } else {
          res.write(
            `data: ${JSON.stringify({ error: { message: error.message } })}\n\n`
          );
          // Принудительно отправляем данные немедленно
          if ("flush" in res && typeof (res as any).flush === "function") {
            (res as any).flush();
          }
          res.end();
        }
        return; // Не пробрасываем ошибку дальше, так как ответ уже отправлен
      }
    }

    // Обычный (не стриминговый) запрос
    // Не передаем userToken - сервис будет использовать CLOUD_AI_DEFAULT_AUTH_TOKEN
    const result = await this.cloudAiService.chatCompletions(
      data,
      undefined,
      undefined // Всегда используем дефолтный токен из конфигурации
    );
    res.json(result);
  }
}
