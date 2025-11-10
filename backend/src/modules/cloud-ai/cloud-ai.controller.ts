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
    const token = authToken?.replace("Bearer ", "") || undefined;

    return await this.cloudAiService.callAgent(data, undefined, token);
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
    const token = authToken?.replace("Bearer ", "") || undefined;

    return await this.cloudAiService.chatCompletions(data, undefined, token);
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
    const token = authToken?.replace("Bearer ", "") || undefined;

    return await this.cloudAiService.textCompletions(data, undefined, token);
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
    const token = authToken?.replace("Bearer ", "") || undefined;

    return await this.cloudAiService.getModels(undefined, token);
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
    const token = authToken?.replace("Bearer ", "") || undefined;

    return await this.cloudAiService.getAgentEmbedCode(
      {
        collapsed,
        referer,
        origin,
      },
      undefined,
      token
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
    @Headers("authorization") authToken?: string,
    @Res({ passthrough: true }) res?: Response,
    @Req() req?: Request
  ): Promise<OpenAiChatCompletionResponseDto> {
    this.logger.debug("Chat completions request received (simple endpoint)");
    
    // Логирование входящих данных для диагностики
    this.logger.debug(`Request body type: ${typeof req?.body}`);
    this.logger.debug(`Request body: ${JSON.stringify(req?.body)}`);
    this.logger.debug(`Messages type: ${typeof data?.messages}`);
    this.logger.debug(`Messages is array: ${Array.isArray(data?.messages)}`);
    this.logger.debug(`Messages value: ${JSON.stringify(data?.messages)}`);

    const token = authToken?.replace("Bearer ", "") || undefined;

    // Если запрос стриминговый, проксируем стрим
    if (data.stream && res) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Отключаем буферизацию в nginx
      res.status(HttpStatus.OK);

      try {
        for await (const chunk of this.cloudAiService.chatCompletionsStream(
          data,
          undefined,
          token
        )) {
          // CloudAiService уже возвращает JSON-строку, просто добавляем префикс SSE
          res.write(`data: ${chunk}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return {} as OpenAiChatCompletionResponseDto; // Не используется при стриминге
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
          res.end();
        }
        throw error;
      }
    }

    // Обычный (не стриминговый) запрос
    const result = await this.cloudAiService.chatCompletions(
      data,
      undefined,
      token
    );
    return result;
  }
}
