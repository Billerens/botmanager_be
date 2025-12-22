import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { BotsService } from "./bots.service";
import { PublicBookingBotResponseDto } from "./dto/public-bot-response.dto";

/**
 * Публичные эндпоинты для ботов
 *
 * ВАЖНО: Shop эндпоинты перенесены в PublicShopsController (/public/shops/:id)
 * Legacy эндпоинты /public/bots/:id/shop удалены
 */
@ApiTags("Публичные эндпоинты")
@Controller("public")
export class PublicBotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get("bots/by-slug/:slug/booking")
  @ApiOperation({
    summary: "Получить данные бота для бронирования по slug",
    description:
      "Используется для публичных субдоменов: {slug}.booking.botmanagertest.online",
  })
  @ApiResponse({
    status: 200,
    description: "Данные бота для бронирования получены",
    content: {
      "application/json": {
        schema: {
          $ref: getSchemaPath(PublicBookingBotResponseDto),
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или бронирование не активно",
  })
  async getBotForBookingBySlug(@Param("slug") slug: string) {
    return this.botsService.getPublicBotForBookingBySlug(slug);
  }

  @Get("bots/:id/booking")
  @ApiOperation({ summary: "Получить данные бота для публичного бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные бота для бронирования получены",
    content: {
      "application/json": {
        schema: {
          $ref: getSchemaPath(PublicBookingBotResponseDto),
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или бронирование не активно",
  })
  async getBotForBooking(@Param("id") id: string) {
    return this.botsService.getPublicBotForBooking(id);
  }
}
