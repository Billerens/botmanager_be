import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { BotsService } from "./bots.service";

@ApiTags("Публичные эндпоинты")
@Controller("public")
export class PublicBotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get("bots/:id/shop")
  @ApiOperation({ summary: "Получить данные бота для публичного магазина" })
  @ApiResponse({ status: 200, description: "Данные бота получены" })
  @ApiResponse({ status: 404, description: "Бот не найден или магазин не активен" })
  async getBotForShop(@Param("id") id: string) {
    return this.botsService.getPublicBotForShop(id);
  }
}
