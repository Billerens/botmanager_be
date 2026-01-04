import {
  Controller,
  Post,
  Param,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  RawBodyRequest,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { PaymentTransactionService } from "../services/payment-transaction.service";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";

/**
 * Контроллер для обработки webhook от платёжных провайдеров
 * для разных типов сущностей (Shop, BookingSystem, CustomPage, Bot)
 */
@ApiTags("Payment Webhooks")
@Controller("payments/webhooks")
export class EntityWebhookController {
  private readonly logger = new Logger(EntityWebhookController.name);

  constructor(
    private readonly paymentTransactionService: PaymentTransactionService
  ) {}

  // ===============================================
  // Shop Webhooks
  // ===============================================

  @Post("shop/:shopId/yookassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для YooKassa (Shop)" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  async handleShopYookassaWebhook(
    @Param("shopId") shopId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received YooKassa webhook for shop ${shopId}`);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.SHOP,
      shopId,
      "yookassa",
      payload
    );

    return { success: true };
  }

  @Post("shop/:shopId/tinkoff")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Tinkoff (Shop)" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  async handleShopTinkoffWebhook(
    @Param("shopId") shopId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received Tinkoff webhook for shop ${shopId}`);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.SHOP,
      shopId,
      "tinkoff",
      payload
    );

    return "OK";
  }

  @Post("shop/:shopId/robokassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Robokassa (Shop)" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  async handleShopRobokassaWebhook(
    @Param("shopId") shopId: string,
    @Body() body: any,
    @Query() query: any
  ) {
    this.logger.log(`Received Robokassa webhook for shop ${shopId}`);

    const payload = Object.keys(body).length > 0 ? body : query;

    const payment = await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.SHOP,
      shopId,
      "robokassa",
      payload
    );

    // Robokassa ожидает ответ в формате OK{InvId}
    return `OK${payment?.externalId || payload.InvId}`;
  }

  @Post("shop/:shopId/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Stripe (Shop)" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiHeader({
    name: "stripe-signature",
    description: "Подпись Stripe webhook",
  })
  async handleShopStripeWebhook(
    @Param("shopId") shopId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    this.logger.log(`Received Stripe webhook for shop ${shopId}`);

    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.SHOP,
      shopId,
      "stripe",
      JSON.parse(rawBody),
      signature
    );

    return { received: true };
  }

  // ===============================================
  // Booking System Webhooks
  // ===============================================

  @Post("booking-system/:bookingSystemId/yookassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для YooKassa (BookingSystem)" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  async handleBookingSystemYookassaWebhook(
    @Param("bookingSystemId") bookingSystemId: string,
    @Body() payload: any
  ) {
    this.logger.log(
      `Received YooKassa webhook for booking system ${bookingSystemId}`
    );

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      "yookassa",
      payload
    );

    return { success: true };
  }

  @Post("booking-system/:bookingSystemId/tinkoff")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Tinkoff (BookingSystem)" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  async handleBookingSystemTinkoffWebhook(
    @Param("bookingSystemId") bookingSystemId: string,
    @Body() payload: any
  ) {
    this.logger.log(
      `Received Tinkoff webhook for booking system ${bookingSystemId}`
    );

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      "tinkoff",
      payload
    );

    return "OK";
  }

  @Post("booking-system/:bookingSystemId/robokassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Robokassa (BookingSystem)" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  async handleBookingSystemRobokassaWebhook(
    @Param("bookingSystemId") bookingSystemId: string,
    @Body() body: any,
    @Query() query: any
  ) {
    this.logger.log(
      `Received Robokassa webhook for booking system ${bookingSystemId}`
    );

    const payload = Object.keys(body).length > 0 ? body : query;

    const payment = await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      "robokassa",
      payload
    );

    return `OK${payment?.externalId || payload.InvId}`;
  }

  @Post("booking-system/:bookingSystemId/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Stripe (BookingSystem)" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiHeader({
    name: "stripe-signature",
    description: "Подпись Stripe webhook",
  })
  async handleBookingSystemStripeWebhook(
    @Param("bookingSystemId") bookingSystemId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    this.logger.log(
      `Received Stripe webhook for booking system ${bookingSystemId}`
    );

    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      "stripe",
      JSON.parse(rawBody),
      signature
    );

    return { received: true };
  }

  // ===============================================
  // Custom Page Webhooks
  // ===============================================

  @Post("custom-page/:customPageId/yookassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для YooKassa (CustomPage)" })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  async handleCustomPageYookassaWebhook(
    @Param("customPageId") customPageId: string,
    @Body() payload: any
  ) {
    this.logger.log(
      `Received YooKassa webhook for custom page ${customPageId}`
    );

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      "yookassa",
      payload
    );

    return { success: true };
  }

  @Post("custom-page/:customPageId/tinkoff")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Tinkoff (CustomPage)" })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  async handleCustomPageTinkoffWebhook(
    @Param("customPageId") customPageId: string,
    @Body() payload: any
  ) {
    this.logger.log(
      `Received Tinkoff webhook for custom page ${customPageId}`
    );

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      "tinkoff",
      payload
    );

    return "OK";
  }

  @Post("custom-page/:customPageId/robokassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Robokassa (CustomPage)" })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  async handleCustomPageRobokassaWebhook(
    @Param("customPageId") customPageId: string,
    @Body() body: any,
    @Query() query: any
  ) {
    this.logger.log(
      `Received Robokassa webhook for custom page ${customPageId}`
    );

    const payload = Object.keys(body).length > 0 ? body : query;

    const payment = await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      "robokassa",
      payload
    );

    return `OK${payment?.externalId || payload.InvId}`;
  }

  @Post("custom-page/:customPageId/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Stripe (CustomPage)" })
  @ApiParam({ name: "customPageId", description: "ID кастомной страницы" })
  @ApiHeader({
    name: "stripe-signature",
    description: "Подпись Stripe webhook",
  })
  async handleCustomPageStripeWebhook(
    @Param("customPageId") customPageId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    this.logger.log(
      `Received Stripe webhook for custom page ${customPageId}`
    );

    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.CUSTOM_PAGE,
      customPageId,
      "stripe",
      JSON.parse(rawBody),
      signature
    );

    return { received: true };
  }

  // ===============================================
  // Bot Webhooks (для Flow-платежей)
  // ===============================================

  @Post("bot/:botId/yookassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для YooKassa (Bot)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  async handleBotYookassaWebhook(
    @Param("botId") botId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received YooKassa webhook for bot ${botId}`);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOT,
      botId,
      "yookassa",
      payload
    );

    return { success: true };
  }

  @Post("bot/:botId/tinkoff")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Tinkoff (Bot)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  async handleBotTinkoffWebhook(
    @Param("botId") botId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received Tinkoff webhook for bot ${botId}`);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOT,
      botId,
      "tinkoff",
      payload
    );

    return "OK";
  }

  @Post("bot/:botId/robokassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Robokassa (Bot)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  async handleBotRobokassaWebhook(
    @Param("botId") botId: string,
    @Body() body: any,
    @Query() query: any
  ) {
    this.logger.log(`Received Robokassa webhook for bot ${botId}`);

    const payload = Object.keys(body).length > 0 ? body : query;

    const payment = await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOT,
      botId,
      "robokassa",
      payload
    );

    return `OK${payment?.externalId || payload.InvId}`;
  }

  @Post("bot/:botId/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Stripe (Bot)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiHeader({
    name: "stripe-signature",
    description: "Подпись Stripe webhook",
  })
  async handleBotStripeWebhook(
    @Param("botId") botId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    this.logger.log(`Received Stripe webhook for bot ${botId}`);

    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    await this.paymentTransactionService.handleWebhook(
      PaymentEntityType.BOT,
      botId,
      "stripe",
      JSON.parse(rawBody),
      signature
    );

    return { received: true };
  }
}

