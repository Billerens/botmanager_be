import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { Request } from "express";
import { IsString, IsOptional, IsNumber, Min } from "class-validator";
import { BookingSystemsService } from "./booking-systems.service";
import {
  PublicBookingSystemResponseDto,
  ErrorResponseDto,
} from "./dto/booking-system-response.dto";
import { PaymentConfigService } from "../payments/services/payment-config.service";
import { PaymentTransactionService } from "../payments/services/payment-transaction.service";
import { PaymentEntityType } from "../../database/entities/payment-config.entity";
import { PaymentTargetType } from "../../database/entities/payment.entity";

// DTO для создания платежа бронирования
class CreatePublicBookingPaymentDto {
  @ApiProperty({ description: "ID платежного провайдера" })
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

@ApiTags("Публичные системы бронирования")
@Controller("public/booking-systems")
export class PublicBookingSystemsController {
  constructor(
    private readonly bookingSystemsService: BookingSystemsService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly paymentTransactionService: PaymentTransactionService
  ) {}

  @Get(":id")
  @ApiOperation({ summary: "Получить публичные данные системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные системы бронирования",
    schema: { $ref: getSchemaPath(PublicBookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getPublicData(@Param("id") id: string) {
    return this.bookingSystemsService.getPublicData(id);
  }

  @Get("by-slug/:slug")
  @ApiOperation({ summary: "Получить публичные данные системы бронирования по slug" })
  @ApiParam({ name: "slug", description: "Slug системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные системы бронирования",
    schema: { $ref: getSchemaPath(PublicBookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getPublicDataBySlug(@Param("slug") slug: string) {
    return this.bookingSystemsService.getPublicDataBySlug(slug);
  }

  @Get(":id/specialists")
  @ApiOperation({ summary: "Получить специалистов системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список специалистов",
  })
  async getSpecialists(@Param("id") id: string) {
    const data = await this.bookingSystemsService.getPublicData(id);
    return data.specialists;
  }

  @Get(":id/services")
  @ApiOperation({ summary: "Получить услуги системы бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список услуг",
  })
  async getServices(@Param("id") id: string) {
    const data = await this.bookingSystemsService.getPublicData(id);
    return data.services;
  }

  // =====================================================
  // PAYMENT ENDPOINTS
  // =====================================================

  @Get(":id/payment-providers")
  @ApiOperation({
    summary: "Получить доступные способы оплаты для системы бронирования",
  })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список провайдеров получен",
  })
  async getPaymentProviders(@Param("id") bookingSystemId: string) {
    const config = await this.paymentConfigService.getConfig(
      PaymentEntityType.BOOKING_SYSTEM,
      bookingSystemId
    );

    if (!config || !config.enabled) {
      return {
        enabled: false,
        providers: [],
      };
    }

    // Формируем список провайдеров с их названиями
    const providerNames: Record<string, { name: string; logo?: string }> = {
      yookassa: { name: "ЮKassa", logo: "/images/yookassa-logo.svg" },
      tinkoff: { name: "Тинькофф Оплата", logo: "/images/tpay-logo.svg" },
      robokassa: { name: "Robokassa", logo: "/images/robokassa-logo.svg" },
      stripe: { name: "Stripe", logo: "/images/stripe-logo.svg" },
      crypto_trc20: {
        name: "USDT TRC-20",
        logo: "/images/usdt-trc20-logo.svg",
      },
    };

    const providers = (config.providers || []).map((providerId) => ({
      id: providerId,
      name: providerNames[providerId]?.name || providerId,
      logo: providerNames[providerId]?.logo,
    }));

    return {
      enabled: true,
      providers,
    };
  }

  @Post(":id/bookings/:bookingId/payment")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Создать платёж для бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiParam({ name: "bookingId", description: "ID бронирования" })
  @ApiResponse({
    status: 200,
    description: "Платёж создан",
  })
  @ApiResponse({
    status: 400,
    description: "Невалидные данные или платежи не настроены",
  })
  @ApiResponse({
    status: 404,
    description: "Бронирование не найдено",
  })
  async createBookingPayment(
    @Param("id") bookingSystemId: string,
    @Param("bookingId") bookingId: string,
    @Body() dto: CreatePublicBookingPaymentDto
  ) {
    // Проверяем существование бронирования
    const booking = await this.bookingSystemsService.getBookingById(
      bookingSystemId,
      bookingId
    );

    if (!booking) {
      throw new Error("Бронирование не найдено");
    }

    // Создаём платёж
    const payment = await this.paymentTransactionService.createPayment({
      entityType: PaymentEntityType.BOOKING_SYSTEM,
      entityId: bookingSystemId,
      targetType: PaymentTargetType.BOOKING,
      targetId: bookingId,
      provider: dto.provider as any,
      amount: dto.amount,
      currency: dto.currency,
      description: `Оплата бронирования #${bookingId.slice(0, 8)}`,
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
      metadata: {
        bookingId,
        bookingSystemId,
      },
    });

    return {
      paymentId: payment.id,
      paymentUrl: payment.paymentUrl,
      externalId: payment.externalId,
    };
  }

  @Get(":id/bookings/:bookingId/payment-status")
  @ApiOperation({ summary: "Получить статус оплаты бронирования" })
  @ApiParam({ name: "id", description: "ID системы бронирования" })
  @ApiParam({ name: "bookingId", description: "ID бронирования" })
  @ApiResponse({
    status: 200,
    description: "Статус оплаты получен",
  })
  async getBookingPaymentStatus(
    @Param("id") bookingSystemId: string,
    @Param("bookingId") bookingId: string
  ) {
    // Проверяем существование бронирования
    const booking = await this.bookingSystemsService.getBookingById(
      bookingSystemId,
      bookingId
    );

    if (!booking) {
      throw new Error("Бронирование не найдено");
    }

    // Получаем платёж для бронирования
    const payment = await this.paymentTransactionService.getPaymentByTarget(
      PaymentTargetType.BOOKING,
      bookingId
    );

    return {
      paymentStatus: booking.paymentStatus || "not_required",
      paymentId: payment?.id,
      paymentUrl: payment?.paymentUrl,
    };
  }
}

