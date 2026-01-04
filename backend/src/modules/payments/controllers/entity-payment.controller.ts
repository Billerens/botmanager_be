import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PaymentTransactionService } from "../services/payment-transaction.service";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";
import {
  Payment,
  PaymentStatus,
  PaymentTargetType,
} from "../../../database/entities/payment.entity";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// DTO для создания платежа для заказа
export class CreateOrderPaymentDto {
  @ApiProperty({ description: "ID провайдера" })
  @IsString()
  provider: string;

  @ApiPropertyOptional({ description: "URL возврата после успешной оплаты" })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ description: "URL возврата при отмене" })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

// DTO для создания платежа для бронирования
export class CreateBookingPaymentDto {
  @ApiProperty({ description: "ID провайдера" })
  @IsString()
  provider: string;

  @ApiProperty({ description: "Сумма платежа" })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: "Валюта" })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ description: "URL возврата после успешной оплаты" })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ description: "URL возврата при отмене" })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

// DTO для возврата
export class RefundPaymentDto {
  @ApiPropertyOptional({ description: "Сумма возврата (если частичный)" })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: "Причина возврата" })
  @IsOptional()
  @IsString()
  reason?: string;
}

// DTO ответа платежа
export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  externalId: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  paymentUrl?: string;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      externalId: payment.externalId,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      paymentUrl: payment.paymentUrl,
      createdAt: payment.createdAt,
    };
  }
}

/**
 * Контроллер для операций с платежами для сущностей
 * (Shop, BookingSystem, CustomPage, Bot)
 */
@ApiTags("Entity Payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("payments/entity")
export class EntityPaymentController {
  private readonly logger = new Logger(EntityPaymentController.name);

  constructor(
    private readonly paymentTransactionService: PaymentTransactionService
  ) {}

  // ===============================================
  // Shop Payments
  // ===============================================

  @Post("shop/:shopId/order/:orderId")
  @ApiOperation({ summary: "Создать платёж для заказа магазина" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 201,
    description: "Платёж создан",
    type: PaymentResponseDto,
  })
  async createShopOrderPayment(
    @Param("shopId") shopId: string,
    @Param("orderId") orderId: string,
    @Body() dto: CreateOrderPaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Creating payment for shop ${shopId}, order ${orderId}`);

    const payment = await this.paymentTransactionService.createOrderPayment(
      shopId,
      orderId,
      dto.provider,
      {
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
      }
    );

    return PaymentResponseDto.fromEntity(payment);
  }

  @Get("shop/:shopId/payments")
  @ApiOperation({ summary: "Получить платежи магазина" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiQuery({ name: "status", required: false, enum: PaymentStatus })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Список платежей",
    type: [PaymentResponseDto],
  })
  async getShopPayments(
    @Param("shopId") shopId: string,
    @Query("status") status?: PaymentStatus,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentTransactionService.getPaymentsByEntity(
      PaymentEntityType.SHOP,
      shopId,
      { status, limit, offset }
    );

    return payments.map(PaymentResponseDto.fromEntity);
  }

  @Get("shop/:shopId/order/:orderId/payment")
  @ApiOperation({ summary: "Получить платёж для заказа" })
  @ApiParam({ name: "shopId", description: "ID магазина" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 200,
    description: "Платёж заказа",
    type: PaymentResponseDto,
  })
  async getOrderPayment(
    @Param("shopId") shopId: string,
    @Param("orderId") orderId: string
  ): Promise<PaymentResponseDto | null> {
    const payment = await this.paymentTransactionService.getPaymentByTarget(
      PaymentTargetType.ORDER,
      orderId
    );

    return payment ? PaymentResponseDto.fromEntity(payment) : null;
  }

  // ===============================================
  // Booking System Payments
  // ===============================================

  @Post("booking-system/:bookingSystemId/booking/:bookingId")
  @ApiOperation({ summary: "Создать платёж для бронирования" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiParam({ name: "bookingId", description: "ID бронирования" })
  @ApiResponse({
    status: 201,
    description: "Платёж создан",
    type: PaymentResponseDto,
  })
  async createBookingPayment(
    @Param("bookingSystemId") bookingSystemId: string,
    @Param("bookingId") bookingId: string,
    @Body() dto: CreateBookingPaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Creating payment for booking system ${bookingSystemId}, booking ${bookingId}`
    );

    const payment = await this.paymentTransactionService.createBookingPayment(
      bookingSystemId,
      bookingId,
      dto.provider,
      dto.amount,
      dto.currency,
      {
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
      }
    );

    return PaymentResponseDto.fromEntity(payment);
  }

  @Get("booking-system/:bookingSystemId/payments")
  @ApiOperation({ summary: "Получить платежи системы бронирования" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiQuery({ name: "status", required: false, enum: PaymentStatus })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Список платежей",
    type: [PaymentResponseDto],
  })
  async getBookingSystemPayments(
    @Param("bookingSystemId") bookingSystemId: string,
    @Query("status") status?: PaymentStatus,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentTransactionService.getPaymentsByEntity(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId,
      { status, limit, offset }
    );

    return payments.map(PaymentResponseDto.fromEntity);
  }

  @Get("booking-system/:bookingSystemId/booking/:bookingId/payment")
  @ApiOperation({ summary: "Получить платёж для бронирования" })
  @ApiParam({ name: "bookingSystemId", description: "ID системы бронирования" })
  @ApiParam({ name: "bookingId", description: "ID бронирования" })
  @ApiResponse({
    status: 200,
    description: "Платёж бронирования",
    type: PaymentResponseDto,
  })
  async getBookingPayment(
    @Param("bookingSystemId") bookingSystemId: string,
    @Param("bookingId") bookingId: string
  ): Promise<PaymentResponseDto | null> {
    const payment = await this.paymentTransactionService.getPaymentByTarget(
      PaymentTargetType.BOOKING,
      bookingId
    );

    return payment ? PaymentResponseDto.fromEntity(payment) : null;
  }

  // ===============================================
  // Generic Payment Operations
  // ===============================================

  @Get(":paymentId")
  @ApiOperation({ summary: "Получить платёж по ID" })
  @ApiParam({ name: "paymentId", description: "ID платежа" })
  @ApiResponse({
    status: 200,
    description: "Платёж",
    type: PaymentResponseDto,
  })
  async getPayment(
    @Param("paymentId") paymentId: string
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentTransactionService.getPayment(paymentId);
    return PaymentResponseDto.fromEntity(payment);
  }

  @Post(":paymentId/check-status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверить статус платежа у провайдера" })
  @ApiParam({ name: "paymentId", description: "ID платежа" })
  @ApiResponse({
    status: 200,
    description: "Обновлённый платёж",
    type: PaymentResponseDto,
  })
  async checkPaymentStatus(
    @Param("paymentId") paymentId: string
  ): Promise<PaymentResponseDto> {
    const payment =
      await this.paymentTransactionService.checkPaymentStatus(paymentId);
    return PaymentResponseDto.fromEntity(payment);
  }

  @Post(":paymentId/refund")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Возврат платежа" })
  @ApiParam({ name: "paymentId", description: "ID платежа" })
  @ApiResponse({
    status: 200,
    description: "Платёж с возвратом",
    type: PaymentResponseDto,
  })
  async refundPayment(
    @Param("paymentId") paymentId: string,
    @Body() dto: RefundPaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Refunding payment ${paymentId}`);

    const payment = await this.paymentTransactionService.refundPayment(
      paymentId,
      dto.amount,
      dto.reason
    );

    return PaymentResponseDto.fromEntity(payment);
  }

  @Post(":paymentId/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отмена платежа" })
  @ApiParam({ name: "paymentId", description: "ID платежа" })
  @ApiResponse({
    status: 200,
    description: "Отменённый платёж",
    type: PaymentResponseDto,
  })
  async cancelPayment(
    @Param("paymentId") paymentId: string
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Canceling payment ${paymentId}`);

    const payment =
      await this.paymentTransactionService.cancelPayment(paymentId);

    return PaymentResponseDto.fromEntity(payment);
  }
}
