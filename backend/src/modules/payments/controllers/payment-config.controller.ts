import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import {
  PaymentConfigService,
  UpdatePaymentConfigDto,
} from "../services/payment-config.service";
import {
  PaymentTestService,
  WebhookEventType,
} from "../services/payment-test.service";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";

/**
 * Контроллер для управления настройками платежей разных сущностей
 */
@ApiTags("Payment Config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments/config")
export class PaymentConfigController {
  constructor(
    private readonly configService: PaymentConfigService,
    private readonly testService: PaymentTestService
  ) {}

  // ============================================
  // Shop
  // ============================================

  @Get("shop/:shopId")
  @ApiOperation({ summary: "Получить настройки платежей для магазина" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiResponse({ status: 200, description: "Настройки платежей" })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async getShopConfig(@Param("shopId") shopId: string, @Request() req: any) {
    return this.configService.getConfigForFrontend(
      PaymentEntityType.SHOP,
      shopId,
      req.user.id
    );
  }

  @Put("shop/:shopId")
  @ApiOperation({ summary: "Сохранить настройки платежей для магазина" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiResponse({ status: 200, description: "Настройки сохранены" })
  @ApiResponse({ status: 404, description: "Магазин не найден" })
  async saveShopConfig(
    @Param("shopId") shopId: string,
    @Body() dto: UpdatePaymentConfigDto,
    @Request() req: any
  ) {
    return this.configService.saveConfig(
      PaymentEntityType.SHOP,
      shopId,
      dto,
      req.user.id
    );
  }

  @Delete("shop/:shopId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить настройки платежей для магазина" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  async deleteShopConfig(@Param("shopId") shopId: string, @Request() req: any) {
    await this.configService.deleteConfig(
      PaymentEntityType.SHOP,
      shopId,
      req.user.id
    );
  }

  // ============================================
  // Booking System
  // ============================================

  @Get("booking-system/:bookingSystemId")
  @ApiOperation({
    summary: "Получить настройки платежей для системы бронирования",
  })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiResponse({ status: 200, description: "Настройки платежей" })
  @ApiResponse({ status: 404, description: "Система бронирования не найдена" })
  async getBookingSystemConfig(
    @Param("bookingSystemId") bookingSystemId: string,
    @Request() req: any
  ) {
    return this.configService.getConfigForFrontend(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      req.user.id
    );
  }

  @Put("booking-system/:bookingSystemId")
  @ApiOperation({
    summary: "Сохранить настройки платежей для системы бронирования",
  })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiResponse({ status: 200, description: "Настройки сохранены" })
  @ApiResponse({ status: 404, description: "Система бронирования не найдена" })
  async saveBookingSystemConfig(
    @Param("bookingSystemId") bookingSystemId: string,
    @Body() dto: UpdatePaymentConfigDto,
    @Request() req: any
  ) {
    return this.configService.saveConfig(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      dto,
      req.user.id
    );
  }

  @Delete("booking-system/:bookingSystemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить настройки платежей для системы бронирования",
  })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  async deleteBookingSystemConfig(
    @Param("bookingSystemId") bookingSystemId: string,
    @Request() req: any
  ) {
    await this.configService.deleteConfig(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      req.user.id
    );
  }

  // ============================================
  // Custom Page
  // ============================================

  @Get("custom-page/:customPageId")
  @ApiOperation({
    summary: "Получить настройки платежей для кастомной страницы",
  })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  @ApiResponse({ status: 200, description: "Настройки платежей" })
  @ApiResponse({ status: 404, description: "Кастомная страница не найдена" })
  async getCustomPageConfig(
    @Param("customPageId") customPageId: string,
    @Request() req: any
  ) {
    return this.configService.getConfigForFrontend(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      req.user.id
    );
  }

  @Put("custom-page/:customPageId")
  @ApiOperation({
    summary: "Сохранить настройки платежей для кастомной страницы",
  })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  @ApiResponse({ status: 200, description: "Настройки сохранены" })
  @ApiResponse({ status: 404, description: "Кастомная страница не найдена" })
  async saveCustomPageConfig(
    @Param("customPageId") customPageId: string,
    @Body() dto: UpdatePaymentConfigDto,
    @Request() req: any
  ) {
    return this.configService.saveConfig(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      dto,
      req.user.id
    );
  }

  @Delete("custom-page/:customPageId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить настройки платежей для кастомной страницы",
  })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  async deleteCustomPageConfig(
    @Param("customPageId") customPageId: string,
    @Request() req: any
  ) {
    await this.configService.deleteConfig(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      req.user.id
    );
  }

  // ============================================
  // Bot
  // ============================================

  @Get("bot/:botId")
  @ApiOperation({ summary: "Получить настройки платежей для бота" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Настройки платежей" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async getBotConfig(@Param("botId") botId: string, @Request() req: any) {
    return this.configService.getConfigForFrontend(
      PaymentEntityType.BOT,
      botId,
      req.user.id
    );
  }

  @Put("bot/:botId")
  @ApiOperation({ summary: "Сохранить настройки платежей для бота" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Настройки сохранены" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async saveBotConfig(
    @Param("botId") botId: string,
    @Body() dto: UpdatePaymentConfigDto,
    @Request() req: any
  ) {
    return this.configService.saveConfig(
      PaymentEntityType.BOT,
      botId,
      dto,
      req.user.id
    );
  }

  @Delete("bot/:botId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить настройки платежей для бота" })
  @ApiParam({ name: "botId", description: "ID бота" })
  async deleteBotConfig(@Param("botId") botId: string, @Request() req: any) {
    await this.configService.deleteConfig(
      PaymentEntityType.BOT,
      botId,
      req.user.id
    );
  }

  // ============================================
  // Универсальный endpoint
  // ============================================

  @Get(":entityType/:entityId")
  @ApiOperation({ summary: "Получить настройки платежей для сущности" })
  @ApiParam({
    name: "entityType",
    enum: PaymentEntityType,
    description: "Тип сущности",
  })
  @ApiParam({ name: "entityId", description: "ID сущности" })
  async getConfig(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Request() req: any
  ) {
    return this.configService.getConfigForFrontend(
      entityType,
      entityId,
      req.user.id
    );
  }

  @Put(":entityType/:entityId")
  @ApiOperation({ summary: "Сохранить настройки платежей для сущности" })
  @ApiParam({
    name: "entityType",
    enum: PaymentEntityType,
    description: "Тип сущности",
  })
  @ApiParam({ name: "entityId", description: "ID сущности" })
  async saveConfig(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Body() dto: UpdatePaymentConfigDto,
    @Request() req: any
  ) {
    return this.configService.saveConfig(
      entityType,
      entityId,
      dto,
      req.user.id
    );
  }

  // ============================================
  // Тестирование
  // ============================================

  @Post(":entityType/:entityId/test/:provider")
  @ApiOperation({ summary: "Комплексное тестирование провайдера" })
  @ApiParam({
    name: "entityType",
    enum: PaymentEntityType,
    description: "Тип сущности",
  })
  @ApiParam({ name: "entityId", description: "ID сущности" })
  @ApiParam({ name: "provider", description: "Платёжный провайдер" })
  async testProvider(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Param("provider") provider: string,
    @Body() body: { skipPaymentTest?: boolean; testAmount?: number },
    @Request() req: any
  ) {
    // Проверяем права доступа через configService
    await this.configService.getConfig(entityType, entityId, req.user.id);

    return this.testService.runProviderTest(entityType, entityId, provider, {
      skipPaymentTest: body.skipPaymentTest,
      testAmount: body.testAmount,
    });
  }

  @Post(":entityType/:entityId/test/:provider/config")
  @ApiOperation({ summary: "Тестирование только конфигурации (без платежа)" })
  async testProviderConfig(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Param("provider") provider: string,
    @Request() req: any
  ) {
    await this.configService.getConfig(entityType, entityId, req.user.id);
    return this.testService.testConfigOnly(entityType, entityId, provider);
  }

  @Post(":entityType/:entityId/test/:provider/payment")
  @ApiOperation({ summary: "Создание тестового платежа" })
  async createTestPayment(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Param("provider") provider: string,
    @Body() body: { amount?: number; currency?: string },
    @Request() req: any
  ) {
    await this.configService.getConfig(entityType, entityId, req.user.id);
    return this.testService.createTestPayment(
      entityType,
      entityId,
      provider,
      body.amount,
      body.currency
    );
  }

  @Post(":entityType/:entityId/test/webhook/simulate")
  @ApiOperation({ summary: "Симуляция webhook" })
  async simulateWebhook(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Body()
    body: { provider: string; event: WebhookEventType; paymentId?: string },
    @Request() req: any
  ) {
    await this.configService.getConfig(entityType, entityId, req.user.id);
    return this.testService.simulateWebhook(
      entityType,
      entityId,
      body.provider,
      body.event,
      body.paymentId
    );
  }

  // ============================================
  // Проверка статуса
  // ============================================

  @Get(":entityType/:entityId/status")
  @ApiOperation({ summary: "Проверить статус платежей для сущности" })
  async getPaymentStatus(
    @Param("entityType") entityType: PaymentEntityType,
    @Param("entityId") entityId: string,
    @Request() req: any
  ) {
    const isEnabled = await this.configService.isPaymentEnabled(
      entityType,
      entityId
    );
    const providers = await this.configService.getEnabledProviders(
      entityType,
      entityId
    );

    return {
      enabled: isEnabled,
      providers,
    };
  }
}

