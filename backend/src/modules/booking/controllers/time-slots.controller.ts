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
import { TimeSlotsService } from "../services/time-slots.service";
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  GenerateTimeSlotsDto,
  GetAvailableSlotsDto,
} from "../dto/booking.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Таймслоты")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("time-slots")
export class TimeSlotsController {
  constructor(private readonly timeSlotsService: TimeSlotsService) {}

  @Post()
  @ApiOperation({ summary: "Создать таймслот" })
  @ApiResponse({ status: 201, description: "Таймслот создан" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async create(@Body() createTimeSlotDto: CreateTimeSlotDto, @Request() req) {
    return this.timeSlotsService.create(createTimeSlotDto, req.user.botId);
  }

  @Post("generate")
  @ApiOperation({ summary: "Сгенерировать таймслоты" })
  @ApiResponse({ status: 201, description: "Таймслоты сгенерированы" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async generate(
    @Body() generateTimeSlotsDto: GenerateTimeSlotsDto,
    @Request() req
  ) {
    return this.timeSlotsService.generateTimeSlots(
      generateTimeSlotsDto,
      req.user.botId
    );
  }

  @Get()
  @ApiOperation({ summary: "Получить список таймслотов" })
  @ApiResponse({ status: 200, description: "Список таймслотов получен" })
  async findAll(@Request() req) {
    return this.timeSlotsService.findAll(req.user.botId);
  }

  @Get("specialist/:specialistId")
  @ApiOperation({ summary: "Получить таймслоты специалиста" })
  @ApiResponse({ status: 200, description: "Таймслоты специалиста получены" })
  async findBySpecialist(
    @Param("specialistId") specialistId: string,
    @Request() req
  ) {
    return this.timeSlotsService.findBySpecialist(specialistId, req.user.botId);
  }

  @Get("available")
  @ApiOperation({ summary: "Получить доступные таймслоты" })
  @ApiResponse({ status: 200, description: "Доступные таймслоты получены" })
  async getAvailable(@Query() query: GetAvailableSlotsDto, @Request() req) {
    return this.timeSlotsService.findAvailableSlots(query, req.user.botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить таймслот по ID" })
  @ApiResponse({ status: 200, description: "Таймслот найден" })
  @ApiResponse({ status: 404, description: "Таймслот не найден" })
  async findOne(@Param("id") id: string, @Request() req) {
    return this.timeSlotsService.findOne(id, req.user.botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить таймслот" })
  @ApiResponse({ status: 200, description: "Таймслот обновлен" })
  @ApiResponse({ status: 404, description: "Таймслот не найден" })
  async update(
    @Param("id") id: string,
    @Body() updateTimeSlotDto: UpdateTimeSlotDto,
    @Request() req
  ) {
    return this.timeSlotsService.update(id, updateTimeSlotDto, req.user.botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить таймслот" })
  @ApiResponse({ status: 200, description: "Таймслот удален" })
  @ApiResponse({ status: 404, description: "Таймслот не найден" })
  async remove(@Param("id") id: string, @Request() req) {
    await this.timeSlotsService.remove(id, req.user.botId);
    return { message: "Таймслот удален" };
  }

  @Post("cleanup")
  @ApiOperation({ summary: "Очистить прошедшие таймслоты" })
  @ApiResponse({ status: 200, description: "Прошедшие таймслоты очищены" })
  async cleanup() {
    const count = await this.timeSlotsService.cleanupPastSlots();
    return { message: `Удалено ${count} прошедших таймслотов` };
  }
}
