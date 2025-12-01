import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import {
  CreatePaymentDto,
  RefundPaymentDto,
  TestPaymentDto,
  PaymentSettingsDto,
  PaymentResponseDto,
  RefundResponseDto,
  PaymentProviderDto,
} from "./dto/payment.dto";
import { Currency } from "./schemas/payment.schemas";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly exchangeRateService: ExchangeRateService
  ) {}

  /**
   * Создание платежа
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Создание платежа" })
  @ApiResponse({
    status: 201,
    description: "Платеж создан",
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Creating payment for bot ${createPaymentDto.botId}`);

    const result = await this.paymentsService.createPayment({
      ...createPaymentDto,
      amount: {
        value: createPaymentDto.amount.value,
        currency: createPaymentDto.amount.currency,
      },
    });

    return {
      id: result.id,
      externalId: result.externalId,
      status: result.status,
      amount: {
        value: result.amount.value,
        currency: result.amount.currency as any,
      },
      paymentUrl: result.paymentUrl,
      createdAt: result.createdAt,
      metadata: result.metadata,
    };
  }

  /**
   * Получение статуса платежа
   */
  @Get(":botId/:module/:provider/:externalPaymentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение статуса платежа" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "module", enum: ["shop", "booking", "api"] })
  @ApiParam({ name: "provider", enum: PaymentProviderDto })
  @ApiParam({ name: "externalPaymentId", description: "Внешний ID платежа" })
  @ApiResponse({ status: 200, description: "Статус платежа" })
  @ApiResponse({ status: 404, description: "Платеж не найден" })
  async getPaymentStatus(
    @Param("botId") botId: string,
    @Param("module") module: "shop" | "booking" | "api",
    @Param("provider") provider: PaymentProviderDto,
    @Param("externalPaymentId") externalPaymentId: string
  ) {
    return this.paymentsService.getPaymentStatus(
      botId,
      module,
      provider as any,
      externalPaymentId
    );
  }

  /**
   * Возврат платежа
   */
  @Post("refund")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Возврат платежа" })
  @ApiResponse({
    status: 200,
    description: "Возврат создан",
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 400, description: "Ошибка возврата" })
  async refundPayment(
    @Body() refundDto: RefundPaymentDto
  ): Promise<RefundResponseDto> {
    const result = await this.paymentsService.refundPayment(
      refundDto.botId,
      refundDto.module as any,
      refundDto.provider as any,
      refundDto.paymentId,
      refundDto.externalPaymentId,
      refundDto.amount,
      refundDto.reason
    );

    return {
      id: result.id,
      paymentId: result.paymentId,
      status: result.status,
      amount: {
        value: result.amount.value,
        currency: result.amount.currency as any,
      },
      createdAt: result.createdAt,
    };
  }

  /**
   * Отмена платежа
   */
  @Post("cancel/:botId/:module/:provider/:externalPaymentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Отмена платежа" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "module", enum: ["shop", "booking", "api"] })
  @ApiParam({ name: "provider", enum: PaymentProviderDto })
  @ApiParam({ name: "externalPaymentId", description: "Внешний ID платежа" })
  @ApiResponse({ status: 200, description: "Платеж отменен" })
  async cancelPayment(
    @Param("botId") botId: string,
    @Param("module") module: "shop" | "booking" | "api",
    @Param("provider") provider: PaymentProviderDto,
    @Param("externalPaymentId") externalPaymentId: string
  ) {
    return this.paymentsService.cancelPayment(
      botId,
      module,
      provider as any,
      externalPaymentId
    );
  }

  /**
   * Тестирование платежа
   */
  @Post("test")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Тестирование платежа" })
  @ApiResponse({
    status: 200,
    description: "Тестовый платеж создан",
    type: PaymentResponseDto,
  })
  async testPayment(
    @Body() testDto: TestPaymentDto
  ): Promise<PaymentResponseDto> {
    const result = await this.paymentsService.testPayment(
      testDto.botId,
      testDto.module as any,
      testDto.provider as any,
      testDto.amount,
      testDto.currency
    );

    return {
      id: result.id,
      externalId: result.externalId,
      status: result.status,
      amount: {
        value: result.amount.value,
        currency: result.amount.currency as any,
      },
      paymentUrl: result.paymentUrl,
      createdAt: result.createdAt,
      metadata: result.metadata,
    };
  }

  /**
   * Получение настроек платежей для бота
   */
  @Get("settings/:botId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение настроек платежей" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Настройки платежей",
    type: PaymentSettingsDto,
  })
  async getPaymentSettings(
    @Param("botId") botId: string
  ): Promise<PaymentSettingsDto> {
    const settings = await this.paymentsService.getPaymentSettings(botId);
    return settings as any;
  }

  /**
   * Сохранение настроек платежей для бота
   */
  @Put("settings/:botId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Сохранение настроек платежей" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Настройки сохранены" })
  async savePaymentSettings(
    @Param("botId") botId: string,
    @Body() settings: PaymentSettingsDto
  ): Promise<{ success: boolean }> {
    await this.paymentsService.savePaymentSettings(botId, settings as any);
    return { success: true };
  }

  /**
   * Получение курсов криптовалют от всех источников
   */
  @Get("exchange-rates/:currency")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение курсов криптовалют" })
  @ApiParam({
    name: "currency",
    description: "Базовая валюта",
    enum: ["RUB", "USD", "EUR", "GBP"],
  })
  @ApiResponse({
    status: 200,
    description: "Курсы от всех источников",
  })
  async getExchangeRates(@Param("currency") currency: string) {
    const validCurrencies = ["RUB", "USD", "EUR", "GBP"];
    if (!validCurrencies.includes(currency)) {
      return {
        error: "Invalid currency",
        validCurrencies,
      };
    }

    return this.exchangeRateService.getAllExchangeRates(currency as Currency);
  }

  /**
   * Webhook для YooKassa
   */
  @Post("webhooks/:botId/yookassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для YooKassa" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Webhook обработан" })
  async handleYookassaWebhook(
    @Param("botId") botId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received YooKassa webhook for bot ${botId}`);

    await this.paymentsService.handleWebhook(botId, "yookassa", payload);

    return { success: true };
  }

  /**
   * Webhook для Tinkoff
   */
  @Post("webhooks/:botId/tinkoff")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Tinkoff" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Webhook обработан" })
  async handleTinkoffWebhook(
    @Param("botId") botId: string,
    @Body() payload: any
  ) {
    this.logger.log(`Received Tinkoff webhook for bot ${botId}`);

    await this.paymentsService.handleWebhook(botId, "tinkoff", payload);

    return "OK";
  }

  /**
   * Webhook для Robokassa (ResultURL)
   */
  @Post("webhooks/:botId/robokassa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Robokassa" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({ status: 200, description: "Webhook обработан" })
  async handleRobokassaWebhook(
    @Param("botId") botId: string,
    @Body() payload: any,
    @Query() query: any
  ) {
    this.logger.log(`Received Robokassa webhook for bot ${botId}`);

    // Robokassa может отправлять данные как в body, так и в query
    const data = Object.keys(payload).length > 0 ? payload : query;

    const webhookData = await this.paymentsService.handleWebhook(
      botId,
      "robokassa",
      data
    );

    // Robokassa ожидает ответ в формате OK{InvId}
    return `OK${webhookData.paymentId}`;
  }

  /**
   * Webhook для Stripe
   */
  @Post("webhooks/:botId/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Webhook для Stripe" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiHeader({
    name: "stripe-signature",
    description: "Подпись Stripe webhook",
  })
  @ApiResponse({ status: 200, description: "Webhook обработан" })
  async handleStripeWebhook(
    @Param("botId") botId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    this.logger.log(`Received Stripe webhook for bot ${botId}`);

    // Stripe требует raw body для верификации подписи
    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    await this.paymentsService.handleWebhook(
      botId,
      "stripe",
      JSON.parse(rawBody),
      signature
    );

    return { received: true };
  }
}
