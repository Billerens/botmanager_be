import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
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

  @Get("bots/:id/shop/products")
  @ApiOperation({
    summary: "Получить товары магазина с пагинацией и фильтрацией",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Номер страницы (начиная с 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Количество товаров на странице",
    example: 20,
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "ID категории для фильтрации",
  })
  @ApiQuery({
    name: "inStock",
    required: false,
    type: Boolean,
    description: "Фильтр по наличию товара",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Поиск по названию товара",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["name-asc", "name-desc", "price-asc", "price-desc"],
    description: "Сортировка товаров",
  })
  @ApiResponse({
    status: 200,
    description: "Товары получены успешно",
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или магазин не активен",
  })
  async getShopProducts(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("categoryId") categoryId?: string,
    @Query("inStock") inStock?: string,
    @Query("search") search?: string,
    @Query("sortBy")
    sortBy?: "name-asc" | "name-desc" | "price-asc" | "price-desc"
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const inStockBool =
      inStock !== undefined ? inStock === "true" : undefined;

    return this.botsService.getPublicShopProducts(
      id,
      pageNum,
      limitNum,
      categoryId,
      inStockBool,
      search,
      sortBy
    );
  }
}
