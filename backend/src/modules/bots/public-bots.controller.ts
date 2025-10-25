import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { BotsService } from "./bots.service";
import {
  PublicShopBotResponseDto,
  PublicBookingBotResponseDto,
} from "./dto/public-bot-response.dto";

@ApiTags("Публичные эндпоинты")
@Controller("public")
export class PublicBotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get("bots/:id/shop")
  @ApiOperation({ summary: "Получить данные бота для публичного магазина" })
  @ApiResponse({
    status: 200,
    description: "Данные бота для магазина получены",
    content: {
      "application/json": {
        schema: {
          $ref: getSchemaPath(PublicShopBotResponseDto),
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или магазин не активен",
  })
  async getBotForShop(@Param("id") id: string) {
    return this.botsService.getPublicBotForShop(id);
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
