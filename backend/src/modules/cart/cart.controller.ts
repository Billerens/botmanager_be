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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger";
import { CartService } from "./cart.service";
import {
  AddItemToCartDto,
  UpdateCartItemDto,
  RemoveItemFromCartDto,
} from "./dto/cart.dto";

@ApiTags("Публичные эндпоинты - Корзина")
@Controller("public")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get("bots/:botId/cart")
  @ApiOperation({ summary: "Получить корзину пользователя" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiQuery({ name: "telegramUsername", description: "Telegram username пользователя", required: true })
  @ApiResponse({
    status: 200,
    description: "Корзина получена",
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
  })
  async getCart(
    @Param("botId") botId: string,
    @Query("telegramUsername") telegramUsername: string
  ) {
    return this.cartService.getCart(botId, telegramUsername);
  }

  @Post("bots/:botId/cart/items")
  @ApiOperation({ summary: "Добавить товар в корзину" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiQuery({ name: "telegramUsername", description: "Telegram username пользователя", required: true })
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
  async addItem(
    @Param("botId") botId: string,
    @Query("telegramUsername") telegramUsername: string,
    @Body() addItemDto: AddItemToCartDto
  ) {
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
  @ApiQuery({ name: "telegramUsername", description: "Telegram username пользователя", required: true })
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
  async updateItem(
    @Param("botId") botId: string,
    @Query("telegramUsername") telegramUsername: string,
    @Body() updateItemDto: UpdateCartItemDto
  ) {
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
  @ApiQuery({ name: "telegramUsername", description: "Telegram username пользователя", required: true })
  @ApiResponse({
    status: 200,
    description: "Товар удален из корзины",
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден в корзине",
  })
  async removeItem(
    @Param("botId") botId: string,
    @Param("productId") productId: string,
    @Query("telegramUsername") telegramUsername: string
  ) {
    return this.cartService.removeItem(botId, telegramUsername, productId);
  }

  @Delete("bots/:botId/cart")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Очистить корзину" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiQuery({ name: "telegramUsername", description: "Telegram username пользователя", required: true })
  @ApiResponse({
    status: 200,
    description: "Корзина очищена",
  })
  async clearCart(
    @Param("botId") botId: string,
    @Query("telegramUsername") telegramUsername: string
  ) {
    return this.cartService.clearCart(botId, telegramUsername);
  }
}

