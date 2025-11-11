import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { OpenRouterService } from "../../common/openrouter.service";
import {
  OpenRouterChatRequestDto,
  OpenRouterResponseDto,
  OpenRouterErrorResponseDto,
  GenerationStatsDto,
  ModelsListResponseDto,
} from "../../common/dto/openrouter.dto";

/**
 * Контроллер для работы с OpenRouter API
 * Предоставляет эндпоинты для chat completions и получения статистики
 * 
 * Примеры использования API:
 * 
 * 1. Простой chat completion запрос:
 * POST /api/v1/openrouter/chat/completions
 * Body: {
 *   "messages": [
 *     { "role": "user", "content": "Hello!" }
 *   ],
 *   "model": "meta-llama/llama-3.3-70b-instruct",
 *   "temperature": 0.7
 * }
 * 
 * 2. Стриминговый запрос:
 * POST /api/v1/openrouter/chat/completions
 * Body: {
 *   "messages": [
 *     { "role": "user", "content": "Write a story" }
 *   ],
 *   "stream": true
 * }
 * 
 * 3. Запрос с изображением:
 * POST /api/v1/openrouter/chat/completions
 * Body: {
 *   "messages": [
 *     {
 *       "role": "user",
 *       "content": [
 *         { "type": "text", "text": "What's in this image?" },
 *         { "type": "image_url", "image_url": { "url": "https://..." } }
 *       ]
 *     }
 *   ],
 *   "model": "anthropic/claude-3.5-sonnet"
 * }
 * 
 * 4. Получение статистики генерации:
 * GET /api/v1/openrouter/generation/{id}
 * 
 * 5. Получение списка бесплатных моделей:
 * GET /api/v1/openrouter/models/free
 * 
 * 6. Получение всех доступных моделей:
 * GET /api/v1/openrouter/models
 */
@ApiTags("openrouter")
@Controller("api/v1/openrouter")
export class OpenRouterController {
  private readonly logger = new Logger(OpenRouterController.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Chat completions endpoint
   * Поддерживает как обычные, так и стриминговые запросы
   */
  @Post("chat/completions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "OpenRouter chat completions",
    description:
      "Отправляет chat completion запрос к OpenRouter. Поддерживает стриминг (если stream: true в запросе).",
  })
  @ApiResponse({
    status: 200,
    description: "Chat completion response",
    type: OpenRouterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: OpenRouterErrorResponseDto,
  })
  async chatCompletions(
    @Body() request: OpenRouterChatRequestDto,
    @Res() res: Response
  ): Promise<void> {
    this.logger.debug(
      `Chat completions request: model=${request.model || "default"}, messages=${request.messages.length}, stream=${request.stream || false}`
    );

    // Если запрос стриминговый
    if (request.stream) {
      this.logger.debug("Starting streaming response");

      // Устанавливаем заголовки для SSE (Server-Sent Events)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Отключаем буферизацию в nginx
      res.status(HttpStatus.OK);
      res.flushHeaders();

      try {
        // Используем chunk mode для стриминга
        for await (const chunk of this.openRouterService.chatStreamChunk(
          request.messages,
          request
        )) {
          // Отправляем чанк в формате SSE
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);

          // Принудительно отправляем данные
          if ("flush" in res && typeof (res as any).flush === "function") {
            (res as any).flush();
          }
        }

        // Отправляем сигнал завершения
        res.write("data: [DONE]\n\n");
        res.end();

        this.logger.debug("Streaming response completed");
      } catch (error: any) {
        this.logger.error(
          `Error in streaming chat completions: ${error.message}`,
          error.stack
        );

        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            error: {
              status: 500,
              message: error.message || "Failed to stream chat completion",
            },
          });
        } else {
          res.write(
            `data: ${JSON.stringify({ error: { message: error.message } })}\n\n`
          );
          res.end();
        }
      }

      return;
    }

    // Обычный (не стриминговый) запрос
    try {
      const result = await this.openRouterService.chat(
        request.messages,
        request
      );
      res.json(result);
    } catch (error: any) {
      this.logger.error(
        `Error in chat completions: ${error.message}`,
        error.stack
      );
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          status: error.status || 500,
          message: error.message || "Failed to process chat completion",
        },
      });
    }
  }

  /**
   * Получить статистику генерации по ID
   */
  @Get("generation/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get generation statistics",
    description: "Получает статистику конкретной генерации по её ID",
  })
  @ApiParam({
    name: "id",
    description: "ID генерации (получается из ответа chat completions)",
    example: "gen-123456",
  })
  @ApiResponse({
    status: 200,
    description: "Generation statistics",
    type: GenerationStatsDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: OpenRouterErrorResponseDto,
  })
  async getGenerationStats(
    @Param("id") id: string
  ): Promise<GenerationStatsDto> {
    this.logger.debug(`Get generation stats request for ID: ${id}`);

    try {
      return await this.openRouterService.getGenerationStats(id);
    } catch (error: any) {
      this.logger.error(
        `Error getting generation stats: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Получить список бесплатных моделей
   * ВАЖНО: Этот роут должен быть перед @Get("models"), иначе будет перекрыт
   */
  @Get("models/free")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get free models",
    description:
      "Получает список бесплатных моделей OpenRouter (где pricing.prompt === '0' и pricing.completion === '0')",
  })
  @ApiResponse({
    status: 200,
    description: "List of free models",
    type: ModelsListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: OpenRouterErrorResponseDto,
  })
  async getFreeModels(): Promise<ModelsListResponseDto> {
    this.logger.debug("Get free models request received");

    try {
      return await this.openRouterService.getFreeModels();
    } catch (error: any) {
      this.logger.error(
        `Error getting free models: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Получить список всех доступных моделей
   */
  @Get("models")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get all available models",
    description: "Получает список всех доступных моделей OpenRouter",
  })
  @ApiResponse({
    status: 200,
    description: "List of all models",
    type: ModelsListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: OpenRouterErrorResponseDto,
  })
  async getAllModels(): Promise<ModelsListResponseDto> {
    this.logger.debug("Get all models request received");

    try {
      return await this.openRouterService.getModels();
    } catch (error: any) {
      this.logger.error(
        `Error getting all models: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Простой эндпоинт для проверки работоспособности
   */
  @Get("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Health check",
    description: "Проверяет доступность OpenRouter сервиса",
  })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "openrouter" },
      },
    },
  })
  healthCheck(): { status: string; service: string } {
    return {
      status: "ok",
      service: "openrouter",
    };
  }
}

