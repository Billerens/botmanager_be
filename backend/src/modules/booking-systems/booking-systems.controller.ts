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
import { BookingSystemsService, BookingSystemFilters } from "./booking-systems.service";
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

@ApiTags("Системы бронирования")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("booking-systems")
export class BookingSystemsController {
  constructor(private readonly bookingSystemsService: BookingSystemsService) {}

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
  async create(
    @Body() createDto: CreateBookingSystemDto,
    @Request() req
  ) {
    return this.bookingSystemsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Получить список систем бронирования пользователя" })
  @ApiQuery({ name: "search", required: false, description: "Поиск по названию" })
  @ApiQuery({ name: "hasBot", required: false, type: Boolean, description: "Фильтр по наличию привязанного бота" })
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
  @ApiQuery({ name: "excludeId", required: false, description: "ID для исключения (при редактировании)" })
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
    return this.bookingSystemsService.linkBot(id, linkBotDto.botId, req.user.id);
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
    return this.bookingSystemsService.retrySubdomainRegistration(id, req.user.id);
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
}

