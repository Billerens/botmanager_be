import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { BookingMiniAppService } from "../services/booking-mini-app.service";
import { CreateBookingDto } from "../dto/booking.dto";
import {
  SpecialistResponseDto,
  ServiceResponseDto,
  TimeSlotResponseDto,
  BookingResponseDto,
  BookingStatsResponseDto,
  ErrorResponseDto,
} from "../dto/booking-response.dto";

@ApiTags("Публичные эндпоинты бронирования")
@Controller("public")
export class PublicBookingController {
  constructor(private readonly bookingMiniAppService: BookingMiniAppService) {}

  @Get("bots/:id/booking")
  @ApiOperation({ summary: "Получить данные бота для публичного бронирования" })
  @ApiResponse({
    status: 200,
    description: "Данные бота получены",
    schema: {
      type: "object",
      properties: {
        bot: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            name: { type: "string", example: "Мой бот" },
            username: { type: "string", example: "my_bot" },
          },
        },
        specialists: {
          type: "array",
          items: { $ref: getSchemaPath(SpecialistResponseDto) },
        },
        services: {
          type: "array",
          items: { $ref: getSchemaPath(ServiceResponseDto) },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или бронирование не активно",
  })
  async getBotForBooking(@Param("id") id: string) {
    return this.bookingMiniAppService.getPublicBotForBooking(id);
  }

  @Get("bots/:id/specialists")
  @ApiOperation({ summary: "Получить список специалистов для бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список специалистов получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(SpecialistResponseDto),
      },
    },
  })
  async getSpecialists(@Param("id") botId: string) {
    return this.bookingMiniAppService.getPublicSpecialists(botId);
  }

  @Get("bots/:id/services")
  @ApiOperation({ summary: "Получить список услуг для бронирования" })
  @ApiResponse({
    status: 200,
    description: "Список услуг получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(ServiceResponseDto),
      },
    },
  })
  async getServices(@Param("id") botId: string) {
    return this.bookingMiniAppService.getPublicServices(botId);
  }

  @Get("bots/:id/services/specialist/:specialistId")
  @ApiOperation({ summary: "Получить услуги специалиста" })
  @ApiResponse({
    status: 200,
    description: "Услуги специалиста получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(ServiceResponseDto),
      },
    },
  })
  async getServicesBySpecialist(
    @Param("id") botId: string,
    @Param("specialistId") specialistId: string
  ) {
    return this.bookingMiniAppService.getPublicServicesBySpecialist(
      botId,
      specialistId
    );
  }

  @Get("bots/:id/time-slots")
  @ApiOperation({ summary: "Получить доступные таймслоты" })
  @ApiResponse({
    status: 200,
    description: "Доступные таймслоты получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(TimeSlotResponseDto),
      },
    },
  })
  async getTimeSlots(
    @Param("id") botId: string,
    @Query("specialistId") specialistId: string,
    @Query("serviceId") serviceId?: string,
    @Query("date") date?: string
  ) {
    return this.bookingMiniAppService.getPublicTimeSlots(
      botId,
      specialistId,
      serviceId,
      date
    );
  }

  @Post("bots/:id/bookings")
  @ApiOperation({ summary: "Создать бронирование" })
  @ApiResponse({
    status: 201,
    description: "Бронирование создано",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async createBooking(
    @Param("id") botId: string,
    @Body() createBookingDto: CreateBookingDto
  ) {
    return this.bookingMiniAppService.createPublicBooking(
      botId,
      createBookingDto
    );
  }

  @Get("bookings/code/:confirmationCode")
  @ApiOperation({ summary: "Получить бронирование по коду" })
  @ApiResponse({
    status: 200,
    description: "Бронирование найдено",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бронирование не найдено",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getBookingByCode(@Param("confirmationCode") confirmationCode: string) {
    return this.bookingMiniAppService.getBookingByCode(confirmationCode);
  }

  @Post("bookings/confirm/:confirmationCode")
  @ApiOperation({ summary: "Подтвердить бронирование по коду" })
  @ApiResponse({
    status: 200,
    description: "Бронирование подтверждено",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверный код подтверждения",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async confirmBookingByCode(
    @Param("confirmationCode") confirmationCode: string
  ) {
    return this.bookingMiniAppService.confirmBookingByCode(confirmationCode);
  }

  @Post("bookings/cancel/:confirmationCode")
  @ApiOperation({ summary: "Отменить бронирование по коду" })
  @ApiResponse({
    status: 200,
    description: "Бронирование отменено",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Бронирование не может быть отменено",
  })
  async cancelBookingByCode(
    @Param("confirmationCode") confirmationCode: string,
    @Body("reason") reason?: string
  ) {
    return this.bookingMiniAppService.cancelBookingByCode(
      confirmationCode,
      reason
    );
  }

  @Get("bots/:id/statistics")
  @ApiOperation({ summary: "Получить статистику бронирований" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: {
      $ref: getSchemaPath(BookingStatsResponseDto),
    },
  })
  async getStatistics(@Param("id") botId: string) {
    return this.bookingMiniAppService.getBookingStatistics(botId);
  }
}
