import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { BookingsService } from "../services/bookings.service";
import {
  CreateBookingDto,
  UpdateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
} from "../dto/booking.dto";
import { BookingStatus } from "../../../database/entities/booking.entity";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Бронирования")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: "Создать бронирование" })
  @ApiResponse({ status: 201, description: "Бронирование создано" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.create(createBookingDto, botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список бронирований" })
  @ApiResponse({ status: 200, description: "Список бронирований получен" })
  async findAll(@Query("botId") botId: string, @Request() req) {
    return this.bookingsService.findAll(botId);
  }

  @Get("specialist/:specialistId")
  @ApiOperation({ summary: "Получить бронирования специалиста" })
  @ApiResponse({
    status: 200,
    description: "Бронирования специалиста получены",
  })
  async findBySpecialist(
    @Param("specialistId") specialistId: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.findBySpecialist(specialistId, botId);
  }

  @Get("date-range")
  @ApiOperation({ summary: "Получить бронирования за период" })
  @ApiResponse({ status: 200, description: "Бронирования за период получены" })
  async findByDateRange(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.bookingsService.findByDateRange(botId, start, end);
  }

  @Get("status/:status")
  @ApiOperation({ summary: "Получить бронирования по статусу" })
  @ApiResponse({ status: 200, description: "Бронирования по статусу получены" })
  async getByStatus(
    @Param("status") status: BookingStatus,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.getBookingsByStatus(botId, status);
  }

  @Get("upcoming")
  @ApiOperation({ summary: "Получить предстоящие бронирования" })
  @ApiResponse({
    status: 200,
    description: "Предстоящие бронирования получены",
  })
  async getUpcoming(
    @Query("limit") limit: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.bookingsService.getUpcomingBookings(botId, limitNumber);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Получить статистику бронирований" })
  @ApiResponse({ status: 200, description: "Статистика получена" })
  async getStatistics(@Query("botId") botId: string, @Request() req) {
    return this.bookingsService.getStatistics(botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить бронирование по ID" })
  @ApiResponse({ status: 200, description: "Бронирование найдено" })
  @ApiResponse({ status: 404, description: "Бронирование не найдено" })
  async findOne(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.findOne(id, botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить бронирование" })
  @ApiResponse({ status: 200, description: "Бронирование обновлено" })
  @ApiResponse({ status: 404, description: "Бронирование не найдено" })
  async update(
    @Param("id") id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.update(id, updateBookingDto, botId);
  }

  @Post(":id/confirm")
  @ApiOperation({ summary: "Подтвердить бронирование" })
  @ApiResponse({ status: 200, description: "Бронирование подтверждено" })
  @ApiResponse({ status: 400, description: "Неверный код подтверждения" })
  async confirm(
    @Param("id") id: string,
    @Body() confirmBookingDto: ConfirmBookingDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.confirm(id, confirmBookingDto, botId);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Отменить бронирование" })
  @ApiResponse({ status: 200, description: "Бронирование отменено" })
  @ApiResponse({
    status: 400,
    description: "Бронирование не может быть отменено",
  })
  async cancel(
    @Param("id") id: string,
    @Body() cancelBookingDto: CancelBookingDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.cancel(id, cancelBookingDto, botId);
  }

  @Post(":id/complete")
  @ApiOperation({ summary: "Отметить бронирование как завершенное" })
  @ApiResponse({
    status: 200,
    description: "Бронирование отмечено как завершенное",
  })
  async markAsCompleted(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.markAsCompleted(id, botId);
  }

  @Post(":id/no-show")
  @ApiOperation({ summary: "Отметить бронирование как неявка" })
  @ApiResponse({ status: 200, description: "Бронирование отмечено как неявка" })
  async markAsNoShow(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.markAsNoShow(id, botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить бронирование" })
  @ApiResponse({ status: 200, description: "Бронирование удалено" })
  @ApiResponse({ status: 404, description: "Бронирование не найдено" })
  async remove(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    await this.bookingsService.remove(id, botId);
    return { message: "Бронирование удалено" };
  }
}
