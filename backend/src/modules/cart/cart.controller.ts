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
  UseInterceptors,
  ClassSerializerInterceptor,
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
import { ValidatePromocodeDto, ApplyPromocodeDto } from "../shop-promocodes/dto/shop-promocode.dto";

@ApiTags("Публичные эндпоинты - Корзина")
@Controller("public")
@UseGuards(TelegramInitDataGuard)
@UseInterceptors(ClassSerializerInterceptor)
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
    const cart = await this.cartService.getCart(botId, telegramUsername);
    
    // Получаем информацию о примененном промокоде
    const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
      botId,
      cart
    );

    // Возвращаем корзину с информацией о промокоде
    return {
      ...cart,
      appliedPromocode: promocodeInfo
        ? {
            code: promocodeInfo.promocode?.code,
            discount: promocodeInfo.discount,
          }
        : null,
    };
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
    const cart = await this.cartService.addItem(
      botId,
      telegramUsername,
      addItemDto.productId,
      addItemDto.quantity
    );

    // Получаем информацию о примененном промокоде
    const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
      botId,
      cart
    );

    // Возвращаем корзину с информацией о промокоде
    return {
      ...cart,
      appliedPromocode: promocodeInfo
        ? {
            code: promocodeInfo.promocode?.code,
            discount: promocodeInfo.discount,
          }
        : null,
    };
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
    const cart = await this.cartService.updateItem(
      botId,
      telegramUsername,
      updateItemDto.productId,
      updateItemDto.quantity
    );

    // Получаем информацию о примененном промокоде
    const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
      botId,
      cart
    );

    // Возвращаем корзину с информацией о промокоде
    return {
      ...cart,
      appliedPromocode: promocodeInfo
        ? {
            code: promocodeInfo.promocode?.code,
            discount: promocodeInfo.discount,
          }
        : null,
    };
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
    const cart = await this.cartService.removeItem(botId, telegramUsername, productId);

    // Получаем информацию о примененном промокоде
    const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
      botId,
      cart
    );

    // Возвращаем корзину с информацией о промокоде
    return {
      ...cart,
      appliedPromocode: promocodeInfo
        ? {
            code: promocodeInfo.promocode?.code,
            discount: promocodeInfo.discount,
          }
        : null,
    };
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

  @Post("bots/:botId/cart/promocode/validate")
  @ApiOperation({ summary: "Валидировать промокод для корзины" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Промокод валидирован",
  })
  @ApiResponse({
    status: 400,
    description: "Промокод недействителен",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async validatePromocode(
    @Param("botId") botId: string,
    @Request() req,
    @Body() validateDto: ValidatePromocodeDto
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.cartService.validatePromocode(
      botId,
      telegramUsername,
      validateDto.code
    );
  }

  @Post("bots/:botId/cart/promocode/apply")
  @ApiOperation({ summary: "Применить промокод к корзине" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Промокод применен",
  })
  @ApiResponse({
    status: 400,
    description: "Промокод недействителен",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async applyPromocode(
    @Param("botId") botId: string,
    @Request() req,
    @Body() applyDto: ApplyPromocodeDto
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    const cart = await this.cartService.applyPromocode(
      botId,
      telegramUsername,
      applyDto.code
    );

    // Получаем информацию о примененном промокоде
    const promocodeInfo = await this.cartService.getAppliedPromocodeInfo(
      botId,
      cart
    );

    // Возвращаем корзину с информацией о промокоде
    return {
      ...cart,
      appliedPromocode: promocodeInfo
        ? {
            code: promocodeInfo.promocode?.code,
            discount: promocodeInfo.discount,
          }
        : null,
    };
  }

  @Delete("bots/:botId/cart/promocode")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Удалить промокод из корзины" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Промокод удален",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async removePromocode(@Param("botId") botId: string, @Request() req) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    const cart = await this.cartService.removePromocode(botId, telegramUsername);
    
    // Возвращаем корзину без промокода
    return {
      ...cart,
      appliedPromocode: null,
    };
  }
}
