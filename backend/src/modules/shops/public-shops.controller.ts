import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";
import { ShopsService } from "./shops.service";
import { CartService, CartUserIdentifier } from "../cart/cart.service";
import { OrdersService, OrderUserIdentifier } from "../orders/orders.service";
import { PublicShopResponseDto } from "./dto/shop-response.dto";
import { PublicAccessGuard } from "../public-auth/guards/public-access.guard";
import { CreateOrderDto } from "../orders/dto/order.dto";

// Расширяем Request для публичного пользователя
interface PublicRequest extends Request {
  publicUser?: {
    id: string;
    email: string;
    shopId: string;
  };
  telegramUser?: {
    username: string;
  };
}

@ApiTags("Публичные эндпоинты - Магазины")
@Controller("public/shops")
export class PublicShopsController {
  constructor(
    private readonly shopsService: ShopsService,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService
  ) {}

  /**
   * Извлечь идентификатор пользователя из запроса
   */
  private getUserIdentifier(req: PublicRequest): CartUserIdentifier {
    if (req.publicUser?.id) {
      return { publicUserId: req.publicUser.id };
    }
    if (req.telegramUser?.username) {
      return { telegramUsername: req.telegramUser.username };
    }
    // Fallback для анонимных запросов - можно использовать sessionId из cookie
    return {};
  }

  @Get("by-slug/:slug")
  @ApiOperation({
    summary: "Получить магазин по slug",
    description:
      "Используется для публичных субдоменов: {slug}.shops.botmanagertest.online",
  })
  @ApiResponse({
    status: 200,
    description: "Данные магазина получены",
    schema: { $ref: getSchemaPath(PublicShopResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Магазин не найден",
  })
  async getShopBySlug(
    @Param("slug") slug: string
  ): Promise<PublicShopResponseDto> {
    const { shop, categories } =
      await this.shopsService.getPublicDataBySlug(slug);

    return {
      id: shop.id,
      name: shop.name,
      title: shop.title,
      description: shop.description,
      logoUrl: shop.logoUrl,
      customStyles: shop.customStyles,
      buttonTypes: shop.buttonTypes,
      buttonSettings: shop.buttonSettings,
      layoutConfig: shop.layoutConfig,
      browserAccessEnabled: shop.browserAccessEnabled,
      url: shop.url,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        isActive: cat.isActive,
        children: cat.children?.map((child) => ({
          id: child.id,
          name: child.name,
          description: child.description,
          imageUrl: child.imageUrl,
          isActive: child.isActive,
          children: [],
        })),
      })),
      botUsername: shop.bot?.username,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить данные магазина для публичного доступа" })
  @ApiResponse({
    status: 200,
    description: "Данные магазина получены",
    schema: { $ref: getSchemaPath(PublicShopResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Магазин не найден",
  })
  async getShop(@Param("id") id: string): Promise<PublicShopResponseDto> {
    const { shop, categories } = await this.shopsService.getPublicData(id);

    return {
      id: shop.id,
      name: shop.name,
      title: shop.title,
      description: shop.description,
      logoUrl: shop.logoUrl,
      customStyles: shop.customStyles,
      buttonTypes: shop.buttonTypes,
      buttonSettings: shop.buttonSettings,
      layoutConfig: shop.layoutConfig,
      browserAccessEnabled: shop.browserAccessEnabled,
      url: shop.url,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        isActive: cat.isActive,
        children: cat.children?.map((child) => ({
          id: child.id,
          name: child.name,
          description: child.description,
          imageUrl: child.imageUrl,
          isActive: child.isActive,
          children: [],
        })),
      })),
      botUsername: shop.bot?.username,
    };
  }

  @Get(":id/products")
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
    description: "Магазин не найден",
  })
  async getProducts(
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
    const inStockBool = inStock !== undefined ? inStock === "true" : undefined;

    return this.shopsService.getPublicProducts(
      id,
      pageNum,
      limitNum,
      categoryId,
      inStockBool,
      search,
      sortBy
    );
  }

  // =====================================================
  // CART ENDPOINTS
  // =====================================================

  @Get(":id/cart")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получить корзину пользователя" })
  @ApiResponse({ status: 200, description: "Корзина получена" })
  async getCart(@Param("id") id: string, @Req() req: PublicRequest) {
    const user = this.getUserIdentifier(req);
    return this.cartService.getCartByShop(id, user);
  }

  @Post(":id/cart/items")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Добавить товар в корзину" })
  @ApiResponse({ status: 200, description: "Товар добавлен" })
  async addToCart(
    @Param("id") id: string,
    @Req() req: PublicRequest,
    @Body() body: { productId: string; quantity?: number }
  ) {
    const user = this.getUserIdentifier(req);
    return this.cartService.addItemByShop(
      id,
      user,
      body.productId,
      body.quantity || 1
    );
  }

  @Put(":id/cart/items/:productId")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Обновить количество товара в корзине" })
  @ApiResponse({ status: 200, description: "Количество обновлено" })
  async updateCartItem(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Req() req: PublicRequest,
    @Body() body: { quantity: number }
  ) {
    const user = this.getUserIdentifier(req);
    return this.cartService.updateItemByShop(
      id,
      user,
      productId,
      body.quantity
    );
  }

  @Delete(":id/cart/items/:productId")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Удалить товар из корзины" })
  @ApiResponse({ status: 200, description: "Товар удален" })
  async removeFromCart(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Req() req: PublicRequest
  ) {
    const user = this.getUserIdentifier(req);
    return this.cartService.removeItemByShop(id, user, productId);
  }

  @Delete(":id/cart")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Очистить корзину" })
  @ApiResponse({ status: 200, description: "Корзина очищена" })
  async clearCart(@Param("id") id: string, @Req() req: PublicRequest) {
    const user = this.getUserIdentifier(req);
    return this.cartService.clearCartByShop(id, user);
  }

  @Post(":id/cart/promocode")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Применить промокод к корзине" })
  @ApiResponse({ status: 200, description: "Промокод применен" })
  async applyPromocode(
    @Param("id") id: string,
    @Req() req: PublicRequest,
    @Body() body: { code: string }
  ) {
    const user = this.getUserIdentifier(req);
    return this.cartService.applyPromocodeByShop(id, user, body.code);
  }

  @Delete(":id/cart/promocode")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Удалить промокод из корзины" })
  @ApiResponse({ status: 200, description: "Промокод удален" })
  async removePromocode(@Param("id") id: string, @Req() req: PublicRequest) {
    const user = this.getUserIdentifier(req);
    return this.cartService.removePromocodeByShop(id, user);
  }

  // =====================================================
  // ORDERS ENDPOINTS
  // =====================================================

  @Post(":id/orders")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Создать заказ из корзины" })
  @ApiResponse({ status: 201, description: "Заказ создан" })
  async createOrder(
    @Param("id") id: string,
    @Req() req: PublicRequest,
    @Body() createOrderDto: CreateOrderDto
  ) {
    const user = this.getUserIdentifier(req) as OrderUserIdentifier;
    return this.ordersService.createOrderByShop(id, user, createOrderDto);
  }

  @Get(":id/orders")
  @UseGuards(PublicAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получить заказы пользователя" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Заказы получены" })
  async getUserOrders(
    @Param("id") id: string,
    @Req() req: PublicRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const user = this.getUserIdentifier(req) as OrderUserIdentifier;
    return this.ordersService.getUserOrdersByShop(id, user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
