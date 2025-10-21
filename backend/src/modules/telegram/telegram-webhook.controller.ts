import {
  Controller,
  Post,
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
      this.logger.log(`Получен webhook от Telegram: ${JSON.stringify(update)}`);

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
        `Ошибка обработки webhook: ${error.message}`,
        error.stack
      );
      return { ok: false };
    }
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
}
