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

import {
  TelegramWebhookService,
  TelegramUpdate,
} from "./telegram-webhook.service";

@ApiTags("Telegram Webhook")
@Controller("telegram")
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegramWebhookService: TelegramWebhookService
  ) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Обработка Telegram webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook успешно обработан",
  })
  async handleWebhook(
    @Body() update: TelegramUpdate,
    @Headers() headers: Record<string, string>
  ): Promise<{ ok: boolean }> {
    try {
      this.logger.log(`🎯 Получен webhook от Telegram!`);
      this.logger.log(`📦 Update: ${JSON.stringify(update)}`);
      this.logger.log(`📋 Headers: ${JSON.stringify(headers)}`);

      // Проверяем, что запрос действительно от Telegram
      // В production можно добавить проверку подписи
      if (process.env.NODE_ENV === "production") {
        // TODO: Добавить проверку подписи Telegram
        // const signature = headers["x-telegram-bot-api-secret-token"];
        // if (!this.verifyTelegramSignature(update, signature)) {
        //   throw new UnauthorizedException("Invalid Telegram signature");
        // }
      }

      await this.telegramWebhookService.handleWebhook(update);

      return { ok: true };
    } catch (error) {
      this.logger.error(
        `❌ Ошибка обработки webhook: ${error.message}`,
        error.stack
      );
      return { ok: false };
    }
  }

  @Get("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверка доступности webhook эндпоинта" })
  async health(): Promise<any> {
    this.logger.log("🏥 Health check запрос");
    return {
      ok: true,
      message: "Telegram webhook endpoint is accessible",
      timestamp: new Date().toISOString(),
      server: "BotManager API",
    };
  }

  @Post("webhook-test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Тестовый эндпоинт для проверки доступности" })
  async testWebhook(): Promise<any> {
    this.logger.log("🧪 Получен тестовый запрос к webhook");
    return {
      ok: true,
      message: "Webhook доступен!",
      timestamp: new Date().toISOString(),
      server: "BotManager API",
    };
  }

  @Post("set-webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Установка Telegram webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook успешно установлен",
  })
  async setWebhook(): Promise<{ ok: boolean }> {
    try {
      await this.telegramWebhookService.setWebhook();
      return { ok: true };
    } catch (error) {
      this.logger.error(
        `Ошибка установки webhook: ${error.message}`,
        error.stack
      );
      return { ok: false };
    }
  }

  @Post("get-webhook-info")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Получение информации о webhook" })
  @ApiResponse({
    status: 200,
    description: "Информация о webhook",
  })
  async getWebhookInfo(): Promise<any> {
    try {
      const info = await this.telegramWebhookService.getWebhookInfo();
      return { ok: true, data: info };
    } catch (error) {
      this.logger.error(
        `Ошибка получения информации о webhook: ${error.message}`,
        error.stack
      );
      return { ok: false, error: error.message };
    }
  }

  @Post("delete-webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Удаление webhook (для тестирования)" })
  @ApiResponse({
    status: 200,
    description: "Webhook удален",
  })
  async deleteWebhook(): Promise<{ ok: boolean }> {
    try {
      await this.telegramWebhookService.deleteWebhook();
      return { ok: true };
    } catch (error) {
      this.logger.error(
        `Ошибка удаления webhook: ${error.message}`,
        error.stack
      );
      return { ok: false };
    }
  }
}
