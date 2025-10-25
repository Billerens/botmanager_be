import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { BookingMiniAppService } from "../services/booking-mini-app.service";
import { CreateBookingDto } from "../dto/booking.dto";

@ApiTags("Публичные эндпоинты бронирования")
@Controller("public")
export class PublicBookingController {
  constructor(private readonly bookingMiniAppService: BookingMiniAppService) {}

  @Get("bots/:id/booking")
  @ApiOperation({ summary: "Получить данные бота для публичного бронирования" })
  @ApiResponse({ status: 200, description: "Данные бота получены" })
  @ApiResponse({
    status: 404,
    description: "Бот не найден или бронирование не активно",
  })
  async getBotForBooking(@Param("id") id: string) {
    return this.bookingMiniAppService.getPublicBotForBooking(id);
  }

  @Get("bots/:id/specialists")
  @ApiOperation({ summary: "Получить список специалистов для бронирования" })
  @ApiResponse({ status: 200, description: "Список специалистов получен" })
  async getSpecialists(@Param("id") botId: string) {
    return this.bookingMiniAppService.getPublicSpecialists(botId);
  }

  @Get("bots/:id/services")
  @ApiOperation({ summary: "Получить список услуг для бронирования" })
  @ApiResponse({ status: 200, description: "Список услуг получен" })
  async getServices(@Param("id") botId: string) {
    return this.bookingMiniAppService.getPublicServices(botId);
  }

  @Get("bots/:id/services/specialist/:specialistId")
  @ApiOperation({ summary: "Получить услуги специалиста" })
  @ApiResponse({ status: 200, description: "Услуги специалиста получены" })
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
  @ApiResponse({ status: 200, description: "Доступные таймслоты получены" })
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
  @ApiResponse({ status: 201, description: "Бронирование создано" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
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
  @ApiResponse({ status: 200, description: "Бронирование найдено" })
  @ApiResponse({ status: 404, description: "Бронирование не найдено" })
  async getBookingByCode(@Param("confirmationCode") confirmationCode: string) {
    return this.bookingMiniAppService.getBookingByCode(confirmationCode);
  }

  @Post("bookings/confirm/:confirmationCode")
  @ApiOperation({ summary: "Подтвердить бронирование по коду" })
  @ApiResponse({ status: 200, description: "Бронирование подтверждено" })
  @ApiResponse({ status: 400, description: "Неверный код подтверждения" })
  async confirmBookingByCode(
    @Param("confirmationCode") confirmationCode: string
  ) {
    return this.bookingMiniAppService.confirmBookingByCode(confirmationCode);
  }

  @Post("bookings/cancel/:confirmationCode")
  @ApiOperation({ summary: "Отменить бронирование по коду" })
  @ApiResponse({ status: 200, description: "Бронирование отменено" })
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
  @ApiResponse({ status: 200, description: "Статистика получена" })
  async getStatistics(@Param("id") botId: string) {
    return this.bookingMiniAppService.getBookingStatistics(botId);
  }
}
