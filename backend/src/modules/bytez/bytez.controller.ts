import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { BytezService } from "../../common/bytez.service";
import {
  BytezModelRunDto,
  BytezModelResponseDto,
  BytezModelInfoDto,
  BytezListModelsDto,
  BytezChatCompletionCreateParamsDto,
  BytezChatCompletionResponseDto,
} from "../../common/dto/bytez.dto";
import { Res, Req } from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Контроллер для работы с AI моделями через bytez.js
 * Предоставляет API для запуска моделей, получения информации о моделях и т.д.
 */
@ApiTags("bytez-ai")
@Controller("api/v1/bytez")
export class BytezController {
  private readonly logger = new Logger(BytezController.name);

  constructor(private readonly bytezService: BytezService) {}

  /**
   * Запускает модель с входными данными
   * POST /api/v1/bytez/models/run
   */
  @Post("models/run")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Run AI model",
    description:
      "Запускает AI модель через bytez.js с указанными входными данными. Поддерживает различные типы моделей (изображения, текст, аудио и т.д.)",
  })
  @ApiResponse({
    status: 200,
    description: "Model execution result",
    type: BytezModelResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid input or model ID",
  })
  async runModel(@Body() data: BytezModelRunDto): Promise<BytezModelResponseDto> {
    this.logger.debug(`Run model request received for model: ${data.modelId}`);
    return await this.bytezService.runModel(data);
  }

  /**
   * Получает информацию о модели
   * GET /api/v1/bytez/models/:modelId
   */
  @Get("models/:modelId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get model information",
    description: "Получает информацию о конкретной модели",
  })
  @ApiParam({
    name: "modelId",
    description: "ID модели (например, 'mbiarreta/swin-camdeboo-loc')",
    example: "mbiarreta/swin-camdeboo-loc",
  })
  @ApiResponse({
    status: 200,
    description: "Model information",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid model ID",
  })
  async getModelInfo(@Param("modelId") modelId: string): Promise<any> {
    this.logger.debug(`Get model info request received for model: ${modelId}`);
    return await this.bytezService.getModelInfo(modelId);
  }

  /**
   * Получает список доступных моделей
   * GET /api/v1/bytez/models
   */
  @Get("models")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "List available models",
    description:
      "Получает список доступных моделей. Примечание: для получения полного списка моделей используйте bytez.com/model-hub",
  })
  @ApiQuery({
    name: "query",
    required: false,
    type: String,
    description: "Поисковый запрос для фильтрации моделей",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Лимит количества результатов",
  })
  @ApiResponse({
    status: 200,
    description: "List of available models",
  })
  async listModels(
    @Query("query") query?: string,
    @Query("limit") limit?: number
  ): Promise<any> {
    this.logger.debug(`List models request received with query: ${query}, limit: ${limit}`);
    return await this.bytezService.listModels(query, limit);
  }

  /**
   * Проверяет статус API ключа
   * GET /api/v1/bytez/status
   */
  @Get("status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Check Bytez API status",
    description: "Проверяет, настроен ли API ключ для bytez.js",
  })
  @ApiResponse({
    status: 200,
    description: "API status",
    schema: {
      type: "object",
      properties: {
        configured: { type: "boolean" },
        message: { type: "string" },
      },
    },
  })
  async getStatus(): Promise<{ configured: boolean; message: string }> {
    const configured = this.bytezService.isApiKeyConfigured();
    return {
      configured,
      message: configured
        ? "Bytez API key is configured"
        : "Bytez API key is not configured. Set BYTEZ_API_KEY environment variable.",
    };
  }

  /**
   * Получает список доступных моделей для чата
   * GET /api/v1/bytez/models/chat
   */
  @Get("models/chat")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "List available chat models",
    description: "Получает список доступных моделей для чата",
  })
  @ApiResponse({
    status: 200,
    description: "List of available chat models",
  })
  async listChatModels(): Promise<{
    models: Array<{ id: string; name: string; description?: string }>;
    total: number;
  }> {
    this.logger.debug("List chat models request received");
    return await this.bytezService.listChatModels();
  }

  /**
   * OpenAI-совместимый эндпоинт для chat completions через bytez
   * POST /api/v1/bytez/chat/completions
   * Поддерживает как обычные, так и стриминговые запросы
   */
  @Post("chat/completions")
  @ApiOperation({
    summary: "OpenAI-compatible chat completions endpoint via Bytez",
    description:
      "Создает chat completion через bytez. Поддерживает стриминг (если stream: true в запросе).",
  })
  @ApiResponse({
    status: 200,
    description: "Chat completion response (обычный или стриминговый)",
  })
  async chatCompletions(
    @Body() data: BytezChatCompletionCreateParamsDto,
    @Res() res: Response,
    @Req() req?: Request
  ): Promise<void | BytezChatCompletionResponseDto> {
    this.logger.debug("Chat completions request received via Bytez");

    // Если запрос стриминговый, обрабатываем стрим
    if (data.stream) {
      this.logger.debug("Starting streaming response for Bytez");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(HttpStatus.OK);
      res.flushHeaders();

      try {
        // Используем настоящий стриминг через OpenAI-совместимый API bytez
        const upstreamStream =
          await this.bytezService.getChatCompletionsStream(data);

        // Проксируем стрим напрямую, без парсинга и пересборки
        // Это сохраняет оригинальную скорость отправки данных от bytez API
        upstreamStream.on("data", (chunk: Buffer) => {
          this.logger.debug(
            `Proxying chunk (${chunk.length} bytes) directly to client`
          );
          res.write(chunk);
          // Принудительно отправляем данные немедленно, без буферизации
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
        return;
      } catch (error: any) {
        this.logger.error(
          `Error in streaming chat completions via Bytez: ${error.message}`,
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
          if ("flush" in res && typeof (res as any).flush === "function") {
            (res as any).flush();
          }
          res.end();
        }
        return;
      }
    }

    // Обычный (не стриминговый) запрос
    const result = await this.bytezService.chatCompletions(data);
    res.json(result);
  }
}

