import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { CartService } from "./cart.service";
import {
  AddItemToCartDto,
  UpdateCartItemDto,
  RemoveItemFromCartDto,
} from "./dto/cart.dto";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";

@ApiTags("Публичные эндпоинты - Корзина")
@Controller("public")
@UseGuards(TelegramInitDataGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get("bots/:botId/cart")
  @ApiOperation({ summary: "Получить корзину пользователя" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Корзина получена",
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async getCart(@Param("botId") botId: string, @Request() req) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.getCart(botId, telegramUsername);
  }

  @Post("bots/:botId/cart/items")
  @ApiOperation({ summary: "Добавить товар в корзину" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 201,
    description: "Товар добавлен в корзину",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные или недостаточно товара",
  })
  @ApiResponse({
    status: 404,
    description: "Товар или бот не найден",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async addItem(
    @Param("botId") botId: string,
    @Request() req,
    @Body() addItemDto: AddItemToCartDto
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.addItem(
      botId,
      telegramUsername,
      addItemDto.productId,
      addItemDto.quantity
    );
  }

  @Patch("bots/:botId/cart/items")
  @ApiOperation({ summary: "Обновить количество товара в корзине" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Количество товара обновлено",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные или недостаточно товара",
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден в корзине",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async updateItem(
    @Param("botId") botId: string,
    @Request() req,
    @Body() updateItemDto: UpdateCartItemDto
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.updateItem(
      botId,
      telegramUsername,
      updateItemDto.productId,
      updateItemDto.quantity
    );
  }

  @Delete("bots/:botId/cart/items/:productId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Удалить товар из корзины" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "productId", description: "ID товара" })
  @ApiResponse({
    status: 200,
    description: "Товар удален из корзины",
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден в корзине",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async removeItem(
    @Param("botId") botId: string,
    @Param("productId") productId: string,
    @Request() req
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.removeItem(botId, telegramUsername, productId);
  }

  @Delete("bots/:botId/cart")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Очистить корзину" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Корзина очищена",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async clearCart(@Param("botId") botId: string, @Request() req) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.clearCart(botId, telegramUsername);
  }
}
