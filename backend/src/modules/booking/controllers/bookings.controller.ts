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
  getSchemaPath,
} from "@nestjs/swagger";
import { BookingsService } from "../services/bookings.service";
import {
  CreateBookingDto,
  UpdateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
} from "../dto/booking.dto";
import {
  BookingResponseDto,
  BookingStatsResponseDto,
  ErrorResponseDto,
  DeleteResponseDto,
} from "../dto/booking-response.dto";
import { BookingStatus } from "../../../database/entities/booking.entity";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../../bots/guards/bot-permission.guard";
import { BotPermission } from "../../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../../database/entities/bot-user-permission.entity";

@ApiTags("Бронирования")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
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
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.CREATE)
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.create(createBookingDto, botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список бронирований" })
  @ApiResponse({
    status: 200,
    description: "Список бронирований получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BookingResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
  async findAll(@Query("botId") botId: string, @Request() req) {
    return this.bookingsService.findAll(botId);
  }

  @Get("specialist/:specialistId")
  @ApiOperation({ summary: "Получить бронирования специалиста" })
  @ApiResponse({
    status: 200,
    description: "Бронирования специалиста получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BookingResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
  async findBySpecialist(
    @Param("specialistId") specialistId: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.findBySpecialist(specialistId, botId);
  }

  @Get("date-range")
  @ApiOperation({ summary: "Получить бронирования за период" })
  @ApiResponse({
    status: 200,
    description: "Бронирования за период получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BookingResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
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
  @ApiResponse({
    status: 200,
    description: "Бронирования по статусу получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BookingResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
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
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BookingResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
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
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: {
      $ref: getSchemaPath(BookingStatsResponseDto),
    },
  })
  @BotPermission(BotEntity.ANALYTICS, PermissionAction.READ)
  async getStatistics(@Query("botId") botId: string, @Request() req) {
    return this.bookingsService.getStatistics(botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить бронирование по ID" })
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
  @BotPermission(BotEntity.BOOKINGS, PermissionAction.READ)
  async findOne(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.findOne(id, botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить бронирование" })
  @ApiResponse({
    status: 200,
    description: "Бронирование обновлено",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бронирование не найдено",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
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
  @ApiResponse({
    status: 200,
    description: "Бронирование отмечено как неявка",
    schema: {
      $ref: getSchemaPath(BookingResponseDto),
    },
  })
  async markAsNoShow(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.bookingsService.markAsNoShow(id, botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить бронирование" })
  @ApiResponse({
    status: 200,
    description: "Бронирование удалено",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бронирование не найдено",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async remove(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    await this.bookingsService.remove(id, botId);
    return { message: "Бронирование удалено" };
  }
}
