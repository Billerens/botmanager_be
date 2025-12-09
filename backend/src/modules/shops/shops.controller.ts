import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  Put,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";

import { ShopsService } from "./shops.service";
import { ProductsService } from "../products/products.service";
import { CategoriesService } from "../categories/categories.service";
import { OrdersService } from "../orders/orders.service";
import { ShopPromocodesService } from "../shop-promocodes/shop-promocodes.service";
import { CartService } from "../cart/cart.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateShopDto,
  UpdateShopDto,
  UpdateShopSettingsDto,
  LinkBotDto,
  ShopFiltersDto,
} from "./dto/shop.dto";
import {
  ShopResponseDto,
  ShopStatsResponseDto,
} from "./dto/shop-response.dto";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "../products/dto/product.dto";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryFiltersDto,
} from "../categories/dto/category.dto";
import {
  CreateShopPromocodeDto,
  UpdateShopPromocodeDto,
  ShopPromocodeFiltersDto,
} from "../shop-promocodes/dto/shop-promocode.dto";
import { UpdateOrderStatusDto } from "../orders/dto/order.dto";
import { OrderStatus } from "../../database/entities/order.entity";

@ApiTags("Магазины")
@Controller("shops")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly ordersService: OrdersService,
    private readonly promoCodesService: ShopPromocodesService,
    private readonly cartService: CartService
  ) {}

  @Post()
  @ApiOperation({ summary: "Создать новый магазин" })
  @ApiResponse({
    status: 201,
    description: "Магазин успешно создан",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async create(@Body() createShopDto: CreateShopDto, @Request() req) {
    const shop = await this.shopsService.create(createShopDto, req.user.id);
    return this.formatShopResponse(shop);
  }

  @Get()
  @ApiOperation({ summary: "Получить список магазинов пользователя" })
  @ApiResponse({
    status: 200,
    description: "Список магазинов получен",
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(ShopResponseDto) },
    },
  })
  @ApiQuery({ name: "search", required: false, description: "Поиск по названию" })
  @ApiQuery({ name: "hasBot", required: false, type: Boolean, description: "Фильтр по наличию бота" })
  async findAll(@Request() req, @Query() filters: ShopFiltersDto) {
    const shops = await this.shopsService.findAll(req.user.id, filters);
    return shops.map((shop) => this.formatShopResponse(shop));
  }

  @Get("by-bot/:botId")
  @ApiOperation({ summary: "Получить магазин по ID бота" })
  @ApiResponse({
    status: 200,
    description: "Магазин найден",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async findByBotId(@Param("botId") botId: string, @Request() req) {
    const shop = await this.shopsService.findByBotId(botId, req.user.id);
    if (!shop) {
      return null;
    }
    return this.formatShopResponse(shop);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить магазин по ID" })
  @ApiResponse({
    status: 200,
    description: "Магазин найден",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async findOne(@Param("id") id: string, @Request() req) {
    const shop = await this.shopsService.findOne(id, req.user.id);
    return this.formatShopResponse(shop);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить магазин" })
  @ApiResponse({
    status: 200,
    description: "Магазин обновлен",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async update(
    @Param("id") id: string,
    @Body() updateShopDto: UpdateShopDto,
    @Request() req
  ) {
    const shop = await this.shopsService.update(id, updateShopDto, req.user.id);
    return this.formatShopResponse(shop);
  }

  @Patch(":id/settings")
  @ApiOperation({ summary: "Обновить настройки магазина" })
  @ApiResponse({
    status: 200,
    description: "Настройки обновлены",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async updateSettings(
    @Param("id") id: string,
    @Body() settings: UpdateShopSettingsDto,
    @Request() req
  ) {
    const shop = await this.shopsService.updateSettings(
      id,
      settings,
      req.user.id
    );
    return this.formatShopResponse(shop);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить магазин" })
  @ApiResponse({ status: 200, description: "Магазин удален" })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async remove(@Param("id") id: string, @Request() req) {
    await this.shopsService.remove(id, req.user.id);
    return { message: "Магазин удален" };
  }

  @Patch(":id/link-bot")
  @ApiOperation({ summary: "Привязать бота к магазину" })
  @ApiResponse({
    status: 200,
    description: "Бот привязан",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин или бот не найден" })
  @ApiResponse({ status: 409, description: "Бот уже привязан к другому магазину" })
  async linkBot(
    @Param("id") id: string,
    @Body() linkBotDto: LinkBotDto,
    @Request() req
  ) {
    const shop = await this.shopsService.linkBot(
      id,
      linkBotDto.botId,
      req.user.id
    );
    return this.formatShopResponse(shop);
  }

  @Delete(":id/unlink-bot")
  @ApiOperation({ summary: "Отвязать бота от магазина" })
  @ApiResponse({
    status: 200,
    description: "Бот отвязан",
    schema: { $ref: getSchemaPath(ShopResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  @ApiResponse({ status: 400, description: "К магазину не привязан бот" })
  async unlinkBot(@Param("id") id: string, @Request() req) {
    const shop = await this.shopsService.unlinkBot(id, req.user.id);
    return this.formatShopResponse(shop);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Получить статистику магазина" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: { $ref: getSchemaPath(ShopStatsResponseDto) },
  })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async getStats(@Param("id") id: string, @Request() req) {
    return this.shopsService.getStats(id, req.user.id);
  }

  /**
   * Форматирование ответа магазина
   */
  private formatShopResponse(shop: any): ShopResponseDto {
    return {
      id: shop.id,
      name: shop.name,
      ownerId: shop.ownerId,
      botId: shop.botId,
      logoUrl: shop.logoUrl,
      title: shop.title,
      description: shop.description,
      customStyles: shop.customStyles,
      buttonTypes: shop.buttonTypes,
      buttonSettings: shop.buttonSettings,
      layoutConfig: shop.layoutConfig,
      browserAccessEnabled: shop.browserAccessEnabled,
      browserAccessRequireEmailVerification:
        shop.browserAccessRequireEmailVerification,
      url: shop.url,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
      bot: shop.bot
        ? {
            id: shop.bot.id,
            name: shop.bot.name,
            username: shop.bot.username,
            status: shop.bot.status,
          }
        : undefined,
    };
  }

  // =====================================================
  // PRODUCTS MANAGEMENT
  // =====================================================

  @Get(":id/products")
  @ApiOperation({ summary: "Получить товары магазина" })
  @ApiResponse({ status: 200, description: "Товары получены" })
  async getProducts(
    @Param("id") id: string,
    @Request() req,
    @Query() filters: ProductFiltersDto
  ) {
    return this.productsService.findAll(id, req.user.id, filters);
  }

  @Post(":id/products")
  @ApiOperation({ summary: "Создать товар в магазине" })
  @ApiResponse({ status: 201, description: "Товар создан" })
  async createProduct(
    @Param("id") id: string,
    @Request() req,
    @Body() createProductDto: CreateProductDto
  ) {
    return this.productsService.create(id, req.user.id, createProductDto);
  }

  @Get(":id/products/:productId")
  @ApiOperation({ summary: "Получить товар по ID" })
  @ApiResponse({ status: 200, description: "Товар найден" })
  async getProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Request() req
  ) {
    return this.productsService.findOne(productId, id, req.user.id);
  }

  @Patch(":id/products/:productId")
  @ApiOperation({ summary: "Обновить товар" })
  @ApiResponse({ status: 200, description: "Товар обновлен" })
  async updateProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Request() req,
    @Body() updateProductDto: UpdateProductDto
  ) {
    return this.productsService.update(
      productId,
      id,
      req.user.id,
      updateProductDto
    );
  }

  @Delete(":id/products/:productId")
  @ApiOperation({ summary: "Удалить товар" })
  @ApiResponse({ status: 200, description: "Товар удален" })
  async deleteProduct(
    @Param("id") id: string,
    @Param("productId") productId: string,
    @Request() req
  ) {
    await this.productsService.remove(productId, id, req.user.id);
    return { message: "Товар удален" };
  }

  @Get(":id/products-stats")
  @ApiOperation({ summary: "Получить статистику товаров магазина" })
  @ApiResponse({ status: 200, description: "Статистика получена" })
  async getProductStats(@Param("id") id: string, @Request() req) {
    return this.productsService.getProductStats(id, req.user.id);
  }

  // =====================================================
  // CATEGORIES MANAGEMENT
  // =====================================================

  @Get(":id/categories")
  @ApiOperation({ summary: "Получить категории магазина" })
  @ApiResponse({ status: 200, description: "Категории получены" })
  async getCategories(
    @Param("id") id: string,
    @Request() req,
    @Query() filters: CategoryFiltersDto
  ) {
    return this.categoriesService.findAll(id, req.user.id, filters);
  }

  @Post(":id/categories")
  @ApiOperation({ summary: "Создать категорию в магазине" })
  @ApiResponse({ status: 201, description: "Категория создана" })
  async createCategory(
    @Param("id") id: string,
    @Request() req,
    @Body() createCategoryDto: CreateCategoryDto
  ) {
    return this.categoriesService.create(id, req.user.id, createCategoryDto);
  }

  @Get(":id/categories/:categoryId")
  @ApiOperation({ summary: "Получить категорию по ID" })
  @ApiResponse({ status: 200, description: "Категория найдена" })
  async getCategory(
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Request() req
  ) {
    return this.categoriesService.findOne(categoryId, id, req.user.id);
  }

  @Patch(":id/categories/:categoryId")
  @ApiOperation({ summary: "Обновить категорию" })
  @ApiResponse({ status: 200, description: "Категория обновлена" })
  async updateCategory(
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Request() req,
    @Body() updateCategoryDto: UpdateCategoryDto
  ) {
    return this.categoriesService.update(
      categoryId,
      id,
      req.user.id,
      updateCategoryDto
    );
  }

  @Delete(":id/categories/:categoryId")
  @ApiOperation({ summary: "Удалить категорию" })
  @ApiResponse({ status: 200, description: "Категория удалена" })
  async deleteCategory(
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Request() req
  ) {
    await this.categoriesService.remove(categoryId, id, req.user.id);
    return { message: "Категория удалена" };
  }

  @Get(":id/categories-tree")
  @ApiOperation({ summary: "Получить дерево категорий" })
  @ApiResponse({ status: 200, description: "Дерево категорий получено" })
  async getCategoriesTree(@Param("id") id: string, @Request() req) {
    return this.categoriesService.findTree(id, req.user.id);
  }

  // =====================================================
  // ORDERS MANAGEMENT
  // =====================================================

  @Get(":id/orders")
  @ApiOperation({ summary: "Получить заказы магазина" })
  @ApiQuery({ name: "status", required: false, enum: OrderStatus })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Заказы получены" })
  async getOrders(
    @Param("id") id: string,
    @Request() req,
    @Query("status") status?: OrderStatus,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.ordersService.getOrdersByShop(id, req.user.id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(":id/orders/:orderId")
  @ApiOperation({ summary: "Получить заказ по ID" })
  @ApiResponse({ status: 200, description: "Заказ найден" })
  async getOrder(
    @Param("id") id: string,
    @Param("orderId") orderId: string,
    @Request() req
  ) {
    return this.ordersService.getOrderByShop(orderId, id, req.user.id);
  }

  @Patch(":id/orders/:orderId/status")
  @ApiOperation({ summary: "Обновить статус заказа" })
  @ApiResponse({ status: 200, description: "Статус обновлен" })
  async updateOrderStatus(
    @Param("id") id: string,
    @Param("orderId") orderId: string,
    @Request() req,
    @Body() updateDto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateOrderStatusByShop(
      orderId,
      id,
      req.user.id,
      updateDto
    );
  }

  // =====================================================
  // CARTS MANAGEMENT
  // =====================================================

  @Get(":id/carts")
  @ApiOperation({ summary: "Получить корзины магазина" })
  @ApiQuery({ name: "hideEmpty", required: false, type: Boolean })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Корзины получены" })
  async getCarts(
    @Param("id") id: string,
    @Request() req,
    @Query("hideEmpty") hideEmpty?: string,
    @Query("search") search?: string
  ) {
    // Проверяем права доступа к магазину
    await this.shopsService.findOne(id, req.user.id);
    return this.cartService.getCartsByShopId(
      id,
      hideEmpty === "true",
      search,
      search
    );
  }

  @Delete(":id/carts/:cartId/clear")
  @ApiOperation({ summary: "Очистить корзину" })
  @ApiResponse({ status: 200, description: "Корзина очищена" })
  async clearCart(
    @Param("id") id: string,
    @Param("cartId") cartId: string,
    @Request() req
  ) {
    await this.shopsService.findOne(id, req.user.id);
    return this.cartService.clearCartByAdmin(id, cartId);
  }

  @Patch(":id/carts/:cartId/items/:productId")
  @ApiOperation({ summary: "Обновить количество товара в корзине" })
  @ApiResponse({ status: 200, description: "Товар обновлен" })
  async updateCartItem(
    @Param("id") id: string,
    @Param("cartId") cartId: string,
    @Param("productId") productId: string,
    @Request() req,
    @Body("quantity") quantity: number
  ) {
    await this.shopsService.findOne(id, req.user.id);
    return this.cartService.updateCartItemByAdmin(id, cartId, productId, quantity);
  }

  @Delete(":id/carts/:cartId/items/:productId")
  @ApiOperation({ summary: "Удалить товар из корзины" })
  @ApiResponse({ status: 200, description: "Товар удален" })
  async removeCartItem(
    @Param("id") id: string,
    @Param("cartId") cartId: string,
    @Param("productId") productId: string,
    @Request() req
  ) {
    await this.shopsService.findOne(id, req.user.id);
    return this.cartService.removeCartItemByAdmin(id, cartId, productId);
  }

  // =====================================================
  // PROMOCODES MANAGEMENT
  // =====================================================

  @Get(":id/promocodes")
  @ApiOperation({ summary: "Получить промокоды магазина" })
  @ApiResponse({ status: 200, description: "Промокоды получены" })
  async getPromocodes(
    @Param("id") id: string,
    @Request() req,
    @Query() filters: ShopPromocodeFiltersDto
  ) {
    return this.promoCodesService.findAllByShop(id, req.user.id, filters);
  }

  @Post(":id/promocodes")
  @ApiOperation({ summary: "Создать промокод в магазине" })
  @ApiResponse({ status: 201, description: "Промокод создан" })
  async createPromocode(
    @Param("id") id: string,
    @Request() req,
    @Body() createDto: Omit<CreateShopPromocodeDto, "botId">
  ) {
    return this.promoCodesService.createByShop(id, req.user.id, createDto);
  }

  @Get(":id/promocodes/:promocodeId")
  @ApiOperation({ summary: "Получить промокод по ID" })
  @ApiResponse({ status: 200, description: "Промокод найден" })
  async getPromocode(
    @Param("id") id: string,
    @Param("promocodeId") promocodeId: string,
    @Request() req
  ) {
    return this.promoCodesService.findOneByShop(promocodeId, id, req.user.id);
  }

  @Patch(":id/promocodes/:promocodeId")
  @ApiOperation({ summary: "Обновить промокод" })
  @ApiResponse({ status: 200, description: "Промокод обновлен" })
  async updatePromocode(
    @Param("id") id: string,
    @Param("promocodeId") promocodeId: string,
    @Request() req,
    @Body() updateDto: UpdateShopPromocodeDto
  ) {
    return this.promoCodesService.updateByShop(
      promocodeId,
      id,
      req.user.id,
      updateDto
    );
  }

  @Delete(":id/promocodes/:promocodeId")
  @ApiOperation({ summary: "Удалить промокод" })
  @ApiResponse({ status: 200, description: "Промокод удален" })
  async deletePromocode(
    @Param("id") id: string,
    @Param("promocodeId") promocodeId: string,
    @Request() req
  ) {
    await this.promoCodesService.removeByShop(promocodeId, id, req.user.id);
    return { message: "Промокод удален" };
  }
}

