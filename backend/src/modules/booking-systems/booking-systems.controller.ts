import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  ApiQuery,
  getSchemaPath,
} from "@nestjs/swagger";
import {
  BookingSystemsService,
  BookingSystemFilters,
} from "./booking-systems.service";
import {
  CreateBookingSystemDto,
  UpdateBookingSystemDto,
  UpdateBookingSystemSettingsDto,
  LinkBotDto,
} from "./dto/booking-system.dto";
import {
  BookingSystemResponseDto,
  BookingSystemStatsDto,
  ErrorResponseDto,
  DeleteResponseDto,
} from "./dto/booking-system-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SpecialistsService } from "../booking/services/specialists.service";
import { ServicesService } from "../booking/services/services.service";
import { TimeSlotsService } from "../booking/services/time-slots.service";
import { BookingsService } from "../booking/services/bookings.service";
import {
  CreateSpecialistDto,
  UpdateSpecialistDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateTimeSlotDto,
  GenerateTimeSlotsDto,
  UpdateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
} from "../booking/dto/booking.dto";

@ApiTags("Системы бронирования")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("booking-systems")
export class BookingSystemsController {
  constructor(
    private readonly bookingSystemsService: BookingSystemsService,
    private readonly specialistsService: SpecialistsService,
    private readonly servicesService: ServicesService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly bookingsService: BookingsService
  ) {}

  @Post()
  @ApiOperation({ summary: "Создать систему бронирования" })
  @ApiResponse({
    status: 201,
    description: "Система бронирования создана",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async create(@Body() createDto: CreateBookingSystemDto, @Request() req) {
    return this.bookingSystemsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Получить список систем бронирования пользователя" })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Поиск по названию",
  })
  @ApiQuery({
    name: "hasBot",
    required: false,
    type: Boolean,
    description: "Фильтр по наличию привязанного бота",
  })
  @ApiResponse({
    status: 200,
    description: "Список систем бронирования",
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(BookingSystemResponseDto) },
    },
  })
  async findAll(
    @Query("search") search?: string,
    @Query("hasBot") hasBot?: string,
    @Request() req?
  ) {
    const filters: BookingSystemFilters = {
      search,
      hasBot: hasBot === "true" ? true : hasBot === "false" ? false : undefined,
    };
    return this.bookingSystemsService.findAll(req.user.id, filters);
  }

  @Get("check-slug")
  @ApiOperation({ summary: "Проверить доступность slug" })
  @ApiQuery({ name: "slug", required: true, description: "Проверяемый slug" })
  @ApiQuery({
    name: "excludeId",
    required: false,
    description: "ID для исключения (при редактировании)",
  })
  @ApiResponse({
    status: 200,
    description: "Результат проверки",
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean" },
        slug: { type: "string" },
        message: { type: "string" },
      },
    },
  })
  async checkSlugAvailability(
    @Query("slug") slug: string,
    @Query("excludeId") excludeId?: string
  ) {
    return this.bookingSystemsService.checkSlugAvailability(slug, excludeId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить систему бронирования по ID" })
  @ApiResponse({
    status: 200,
    description: "Система бронирования найдена",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async findOne(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.findOne(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить систему бронирования" })
  @ApiResponse({
    status: 200,
    description: "Система бронирования обновлена",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateBookingSystemDto,
    @Request() req
  ) {
    return this.bookingSystemsService.update(id, updateDto, req.user.id);
  }

  @Patch(":id/settings")
  @ApiOperation({ summary: "Обновить настройки системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Настройки обновлены",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  async updateSettings(
    @Param("id") id: string,
    @Body() settings: UpdateBookingSystemSettingsDto,
    @Request() req
  ) {
    return this.bookingSystemsService.updateSettings(id, settings, req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить систему бронирования" })
  @ApiResponse({
    status: 200,
    description: "Система бронирования удалена",
    schema: { $ref: getSchemaPath(DeleteResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async remove(@Param("id") id: string, @Request() req) {
    await this.bookingSystemsService.remove(id, req.user.id);
    return { message: "Система бронирования удалена" };
  }

  @Patch(":id/link-bot")
  @ApiOperation({ summary: "Привязать бота к системе бронирования" })
  @ApiResponse({
    status: 200,
    description: "Бот привязан",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Система бронирования или бот не найдены",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 409,
    description: "Бот уже привязан к другой системе бронирования",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async linkBot(
    @Param("id") id: string,
    @Body() linkBotDto: LinkBotDto,
    @Request() req
  ) {
    return this.bookingSystemsService.linkBot(
      id,
      linkBotDto.botId,
      req.user.id
    );
  }

  @Delete(":id/unlink-bot")
  @ApiOperation({ summary: "Отвязать бота от системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Бот отвязан",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  @ApiResponse({
    status: 400,
    description: "К системе бронирования не привязан бот",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async unlinkBot(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.unlinkBot(id, req.user.id);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Получить статистику системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: { $ref: getSchemaPath(BookingSystemStatsDto) },
  })
  async getStats(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.getStats(id, req.user.id);
  }

  @Get(":id/subdomain/status")
  @ApiOperation({ summary: "Получить статус субдомена" })
  @ApiResponse({
    status: 200,
    description: "Статус субдомена",
  })
  async getSubdomainStatus(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.getSubdomainStatus(id, req.user.id);
  }

  @Put(":id/subdomain")
  @ApiOperation({ summary: "Обновить slug/субдомен системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Slug обновлён",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  async updateSlug(
    @Param("id") id: string,
    @Body() body: { slug: string | null },
    @Request() req
  ) {
    return this.bookingSystemsService.updateSlug(id, body.slug, req.user.id);
  }

  @Post(":id/subdomain/retry")
  @ApiOperation({ summary: "Повторить регистрацию субдомена" })
  @ApiResponse({
    status: 200,
    description: "Регистрация запущена повторно",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  async retrySubdomainRegistration(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.retrySubdomainRegistration(
      id,
      req.user.id
    );
  }

  @Delete(":id/subdomain")
  @ApiOperation({ summary: "Удалить субдомен системы бронирования" })
  @ApiResponse({
    status: 200,
    description: "Субдомен удалён",
    schema: { $ref: getSchemaPath(BookingSystemResponseDto) },
  })
  async removeSubdomain(@Param("id") id: string, @Request() req) {
    return this.bookingSystemsService.removeSubdomain(id, req.user.id);
  }

  // =====================================================
  // Специалисты
  // =====================================================

  @Get(":id/specialists")
  @ApiOperation({ summary: "Получить специалистов системы бронирования" })
  async getSpecialists(@Param("id") id: string, @Request() req) {
    return this.specialistsService.findAllByBookingSystem(id, req.user.id);
  }

  @Post(":id/specialists")
  @ApiOperation({ summary: "Создать специалиста" })
  async createSpecialist(
    @Param("id") id: string,
    @Body() dto: CreateSpecialistDto,
    @Request() req
  ) {
    return this.specialistsService.createByBookingSystem(dto, id, req.user.id);
  }

  @Get(":id/specialists/:specialistId")
  @ApiOperation({ summary: "Получить специалиста по ID" })
  async getSpecialist(
    @Param("id") id: string,
    @Param("specialistId") specialistId: string,
    @Request() req
  ) {
    return this.specialistsService.findOneByBookingSystem(
      specialistId,
      id,
      req.user.id
    );
  }

  @Patch(":id/specialists/:specialistId")
  @ApiOperation({ summary: "Обновить специалиста" })
  async updateSpecialist(
    @Param("id") id: string,
    @Param("specialistId") specialistId: string,
    @Body() dto: UpdateSpecialistDto,
    @Request() req
  ) {
    return this.specialistsService.updateByBookingSystem(
      specialistId,
      dto,
      id,
      req.user.id
    );
  }

  @Delete(":id/specialists/:specialistId")
  @ApiOperation({ summary: "Удалить специалиста" })
  async deleteSpecialist(
    @Param("id") id: string,
    @Param("specialistId") specialistId: string,
    @Request() req
  ) {
    await this.specialistsService.removeByBookingSystem(
      specialistId,
      id,
      req.user.id
    );
    return { message: "Специалист удалён" };
  }

  @Get(":id/specialists/:specialistId/working-hours")
  @ApiOperation({ summary: "Получить рабочие часы специалиста" })
  async getSpecialistWorkingHours(
    @Param("id") id: string,
    @Param("specialistId") specialistId: string,
    @Request() req
  ) {
    return this.specialistsService.getWorkingHoursByBookingSystem(
      specialistId,
      id,
      req.user.id
    );
  }

  @Patch(":id/specialists/:specialistId/working-hours")
  @ApiOperation({ summary: "Обновить рабочие часы специалиста" })
  async updateSpecialistWorkingHours(
    @Param("id") id: string,
    @Param("specialistId") specialistId: string,
    @Body() workingHours: any,
    @Request() req
  ) {
    return this.specialistsService.updateWorkingHoursByBookingSystem(
      specialistId,
      id,
      req.user.id,
      workingHours
    );
  }

  // =====================================================
  // Услуги
  // =====================================================

  @Get(":id/services")
  @ApiOperation({ summary: "Получить услуги системы бронирования" })
  async getServices(@Param("id") id: string, @Request() req) {
    return this.servicesService.findAllByBookingSystem(id, req.user.id);
  }

  @Post(":id/services")
  @ApiOperation({ summary: "Создать услугу" })
  async createService(
    @Param("id") id: string,
    @Body() dto: CreateServiceDto,
    @Request() req
  ) {
    return this.servicesService.createByBookingSystem(id, req.user.id, dto);
  }

  @Get(":id/services/:serviceId")
  @ApiOperation({ summary: "Получить услугу по ID" })
  async getService(
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
    @Request() req
  ) {
    return this.servicesService.findOneByBookingSystem(
      serviceId,
      id,
      req.user.id
    );
  }

  @Patch(":id/services/:serviceId")
  @ApiOperation({ summary: "Обновить услугу" })
  async updateService(
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
    @Body() dto: UpdateServiceDto,
    @Request() req
  ) {
    return this.servicesService.updateByBookingSystem(
      serviceId,
      id,
      req.user.id,
      dto
    );
  }

  @Delete(":id/services/:serviceId")
  @ApiOperation({ summary: "Удалить услугу" })
  async deleteService(
    @Param("id") id: string,
    @Param("serviceId") serviceId: string,
    @Request() req
  ) {
    await this.servicesService.removeByBookingSystem(
      serviceId,
      id,
      req.user.id
    );
    return { message: "Услуга удалена" };
  }

  // =====================================================
  // Таймслоты
  // =====================================================

  @Get(":id/time-slots")
  @ApiOperation({ summary: "Получить таймслоты системы бронирования" })
  async getTimeSlots(@Param("id") id: string, @Request() req) {
    return this.timeSlotsService.findAllByBookingSystem(id, req.user.id);
  }

  @Post(":id/time-slots")
  @ApiOperation({ summary: "Создать таймслот" })
  async createTimeSlot(
    @Param("id") id: string,
    @Body() dto: CreateTimeSlotDto,
    @Request() req
  ) {
    return this.timeSlotsService.createByBookingSystem(id, req.user.id, dto);
  }

  @Post(":id/time-slots/generate")
  @ApiOperation({ summary: "Сгенерировать таймслоты" })
  async generateTimeSlots(
    @Param("id") id: string,
    @Body() dto: GenerateTimeSlotsDto,
    @Request() req
  ) {
    return this.timeSlotsService.generateTimeSlotsByBookingSystem(
      id,
      req.user.id,
      dto
    );
  }

  @Get(":id/time-slots/available")
  @ApiOperation({ summary: "Получить доступные таймслоты" })
  @ApiQuery({ name: "specialistId", required: true })
  @ApiQuery({ name: "serviceId", required: false })
  @ApiQuery({ name: "date", required: true })
  async getAvailableTimeSlots(
    @Param("id") id: string,
    @Query("specialistId") specialistId: string,
    @Query("date") date: string,
    @Query("serviceId") serviceId?: string
  ) {
    return this.timeSlotsService.findAvailableSlotsByBookingSystem(id, {
      botId: "", // Не используется в методе
      specialistId,
      serviceId,
      date,
    });
  }

  @Delete(":id/time-slots/:slotId")
  @ApiOperation({ summary: "Удалить таймслот" })
  async deleteTimeSlot(
    @Param("id") id: string,
    @Param("slotId") slotId: string,
    @Request() req
  ) {
    await this.timeSlotsService.removeByBookingSystem(slotId, id, req.user.id);
    return { message: "Таймслот удалён" };
  }

  // =====================================================
  // Бронирования
  // =====================================================

  @Get(":id/bookings")
  @ApiOperation({ summary: "Получить бронирования системы" })
  async getBookings(@Param("id") id: string, @Request() req) {
    return this.bookingsService.findAllByBookingSystem(id, req.user.id);
  }

  @Get(":id/bookings/statistics")
  @ApiOperation({ summary: "Получить статистику бронирований" })
  async getBookingsStatistics(@Param("id") id: string, @Request() req) {
    return this.bookingsService.getStatisticsByBookingSystem(id, req.user.id);
  }

  @Get(":id/bookings/:bookingId")
  @ApiOperation({ summary: "Получить бронирование по ID" })
  async getBooking(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Request() req
  ) {
    return this.bookingsService.findOneByBookingSystem(
      bookingId,
      id,
      req.user.id
    );
  }

  @Patch(":id/bookings/:bookingId")
  @ApiOperation({ summary: "Обновить бронирование" })
  async updateBooking(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Body() dto: UpdateBookingDto,
    @Request() req
  ) {
    return this.bookingsService.updateByBookingSystem(
      bookingId,
      id,
      req.user.id,
      dto
    );
  }

  @Patch(":id/bookings/:bookingId/status")
  @ApiOperation({ summary: "Обновить статус бронирования" })
  async updateBookingStatus(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Body() body: { status: string },
    @Request() req
  ) {
    return this.bookingsService.updateByBookingSystem(
      bookingId,
      id,
      req.user.id,
      { status: body.status as any }
    );
  }

  @Post(":id/bookings/:bookingId/confirm")
  @ApiOperation({ summary: "Подтвердить бронирование" })
  async confirmBooking(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Body() body: { confirmationCode: string },
    @Request() req
  ) {
    return this.bookingsService.confirmByBookingSystem(id, bookingId, {
      confirmationCode: body.confirmationCode,
    });
  }

  @Post(":id/bookings/:bookingId/cancel")
  @ApiOperation({ summary: "Отменить бронирование" })
  async cancelBooking(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Body() body: { cancellationReason?: string },
    @Request() req
  ) {
    return this.bookingsService.cancelByBookingSystem(
      bookingId,
      id,
      req.user.id,
      { cancellationReason: body.cancellationReason }
    );
  }

  @Post(":id/bookings/:bookingId/complete")
  @ApiOperation({ summary: "Завершить бронирование" })
  async completeBooking(
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
    @Request() req
  ) {
    return this.bookingsService.markAsCompletedByBookingSystem(
      bookingId,
      id,
      req.user.id
    );
  }
}
