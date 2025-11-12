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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { OpenRouterService } from "../../common/openrouter.service";
import {
  OpenRouterChatRequestDto,
  OpenRouterResponseDto,
  OpenRouterErrorResponseDto,
  GenerationStatsDto,
  ModelsListResponseDto,
} from "../../common/dto/openrouter.dto";

/**
 * Контроллер для работы с платными моделями OpenRouter API
 * Предоставляет эндпоинты для chat completions с использованием моделей из OPENROUTER_ALLOWED_MODELS
 * Если OPENROUTER_ALLOWED_MODELS не задан или пуст, доступны все модели OpenRouter
 *
 * Примеры использования API:
 *
 * 1. Простой chat completion запрос:
 * POST /api/v1/openrouter-paid/chat/completions
 * Body: {
 *   "messages": [
 *     { "role": "user", "content": "Hello!" }
 *   ],
 *   "model": "anthropic/claude-3.5-sonnet",
 *   "temperature": 0.7
 * }
 *
 * 2. Стриминговый запрос:
 * POST /api/v1/openrouter-paid/chat/completions
 * Body: {
 *   "messages": [
 *     { "role": "user", "content": "Write a story" }
 *   ],
 *   "stream": true
 * }
 *
 * 3. Получение списка платных моделей:
 * GET /api/v1/openrouter-paid/models
 */
@ApiTags("openrouter-paid")
@Controller("api/v1/openrouter-paid")
export class OpenRouterPaidController {
  private readonly logger = new Logger(OpenRouterPaidController.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Chat completions endpoint для платных моделей
   * Поддерживает как обычные, так и стриминговые запросы
   * Валидирует, что используемая модель находится в списке разрешенных
   */
  @Post("chat/completions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "OpenRouter paid models chat completions",
    description:
      "Отправляет chat completion запрос к OpenRouter. Если OPENROUTER_ALLOWED_MODELS задан, используются только модели из этого списка. Если не задан, доступны все модели OpenRouter. Поддерживает стриминг (если stream: true в запросе).",
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
      `Paid chat completions request: model=${request.model || "default"}, messages=${request.messages.length}, stream=${request.stream || false}`
    );

    // Валидация модели (если указана)
    // Если OPENROUTER_ALLOWED_MODELS не задан, валидация пропускает все модели
    if (request.model) {
      const paidModels = await this.openRouterService.getPaidModels();
      const isModelAllowed = paidModels.data.some(
        (model) => model.id === request.model
      );

      if (!isModelAllowed) {
        this.logger.warn(
          `Model ${request.model} is not in the allowed paid models list`
        );
        res.status(HttpStatus.BAD_REQUEST).json({
          error: {
            status: 400,
            message: `Model ${request.model} is not in the allowed paid models list. Use GET /api/v1/openrouter-paid/models to see available models.`,
          },
        });
        return;
      }
    }

    // Если запрос стриминговый
    if (request.stream) {
      this.logger.debug("Starting streaming response for paid models");

      let dataSent = false; // Флаг для отслеживания отправки данных

      try {
        // Устанавливаем заголовки для SSE (Server-Sent Events)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Отключаем буферизацию в nginx
        res.status(HttpStatus.OK);
        res.flushHeaders();

        // Используем chunk mode для стриминга
        for await (const chunk of this.openRouterService.chatStreamChunk(
          request.messages,
          request
        )) {
          dataSent = true; // Отметим, что данные начали отправляться

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

        this.logger.debug("Streaming response completed for paid models");
      } catch (error: any) {
        this.logger.warn(
          `Streaming failed for paid models, attempting fallback to non-streaming mode: ${error.message}`
        );

        // Проверяем, является ли ошибка связанной с недоступностью стриминга
        const isStreamingError =
          error.message?.includes("model not found") ||
          error.message?.includes("404") ||
          error.message?.includes("Provider returned error") ||
          error.statusCode === 404;

        // Если это ошибка модели/провайдера и данные еще не отправлялись,
        // пробуем fallback к обычному запросу
        if (isStreamingError && !dataSent) {
          try {
            this.logger.debug(
              "Attempting fallback to non-streaming chat completion for paid models"
            );

            // Пробуем обычный запрос без стриминга
            const nonStreamingRequest = { ...request, stream: false };
            const result = await this.openRouterService.chat(
              request.messages,
              nonStreamingRequest
            );

            // Если заголовки еще не отправлены, устанавливаем их
            if (!res.headersSent) {
              res.setHeader("Content-Type", "text/event-stream");
              res.setHeader("Cache-Control", "no-cache");
              res.setHeader("Connection", "keep-alive");
              res.setHeader("X-Accel-Buffering", "no");
              res.status(HttpStatus.OK);
              res.flushHeaders();
            }

            // Отправляем результат как финальный чанк
            const finalChunk = {
              id: result.id,
              object: "chat.completion.chunk",
              created: result.created,
              model: result.model,
              choices: result.choices.map((choice) => ({
                index: 0,
                delta: {
                  role: choice.message.role,
                  content: choice.message.content || "",
                },
                finish_reason: choice.finish_reason,
              })),
              usage: result.usage,
            };

            res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();

            this.logger.debug(
              "Fallback to non-streaming mode completed successfully for paid models"
            );
            return;
          } catch (fallbackError: any) {
            this.logger.error(
              `Fallback to non-streaming mode also failed for paid models: ${fallbackError.message}`,
              fallbackError.stack
            );
            // Если fallback тоже не сработал, возвращаем исходную ошибку
            if (!res.headersSent) {
              res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: {
                  status: 500,
                  message:
                    fallbackError.message ||
                    error.message ||
                    "Failed to process chat completion",
                },
              });
            } else {
              res.write(
                `data: ${JSON.stringify({
                  error: {
                    message:
                      fallbackError.message ||
                      error.message ||
                      "Failed to process chat completion",
                  },
                })}\n\n`
              );
              res.end();
            }
            return;
          }
        }

        // Если это не ошибка модели или заголовки уже отправлены,
        // возвращаем исходную ошибку
        this.logger.error(
          `Error in streaming chat completions for paid models: ${error.message}`,
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
        `Error in paid chat completions: ${error.message}`,
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
    this.logger.debug(
      `Get generation stats request for ID: ${id} (paid models)`
    );

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
   * Получить список платных моделей
   * Если OPENROUTER_ALLOWED_MODELS не задан или пуст, возвращает все модели OpenRouter
   * Иначе возвращает только модели из списка разрешенных
   */
  @Get("models")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get paid models",
    description:
      "Получает список платных моделей OpenRouter. Если OPENROUTER_ALLOWED_MODELS не задан или пуст, возвращает все доступные модели. Иначе возвращает только модели из списка разрешенных.",
  })
  @ApiResponse({
    status: 200,
    description: "List of paid models",
    type: ModelsListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: OpenRouterErrorResponseDto,
  })
  async getPaidModels(): Promise<ModelsListResponseDto> {
    this.logger.debug("Get paid models request received");

    try {
      return await this.openRouterService.getPaidModels();
    } catch (error: any) {
      this.logger.error(
        `Error getting paid models: ${error.message}`,
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
    description: "Проверяет доступность OpenRouter paid models сервиса",
  })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "openrouter-paid" },
      },
    },
  })
  healthCheck(): { status: string; service: string } {
    return {
      status: "ok",
      service: "openrouter-paid",
    };
  }
}
