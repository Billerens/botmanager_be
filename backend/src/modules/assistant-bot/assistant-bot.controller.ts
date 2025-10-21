import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

import { AssistantBotService, TelegramUpdate } from "./assistant-bot.service";

/**
 * Контроллер для бота-ассистента BotManager
 * Обрабатывает webhook'и от Telegram для бота-помощника
 */
@ApiTags("Assistant Bot")
@Controller("assistant-bot")
export class AssistantBotController {
  private readonly logger = new Logger(AssistantBotController.name);

  constructor(private readonly assistantBotService: AssistantBotService) {}

  @Get("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверка доступности бота-ассистента" })
  async health(): Promise<any> {
    this.logger.log("🏥 Health check");
    return {
      ok: true,
      message: "Assistant Bot webhook endpoint is accessible",
      timestamp: new Date().toISOString(),
      service: "BotManager Assistant Bot",
    };
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для бота-ассистента" })
  @ApiResponse({
    status: 200,
    description: "Webhook обработан",
  })
  async handleWebhook(
    @Body() update: TelegramUpdate,
    @Headers() headers: Record<string, string>
  ): Promise<{ ok: boolean }> {
    try {
      this.logger.log(`🎯 Webhook от Telegram!`);
      this.logger.log(`📦 Update: ${JSON.stringify(update)}`);

      await this.assistantBotService.handleUpdate(update);

      return { ok: true };
    } catch (error) {
      this.logger.error(
        `❌ Ошибка обработки webhook: ${error.message}`,
        error.stack
      );
      return { ok: false };
    }
  }
}
