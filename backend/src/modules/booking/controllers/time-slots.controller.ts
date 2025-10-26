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
import { TimeSlotsService } from "../services/time-slots.service";
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
  GenerateTimeSlotsDto,
  GetAvailableSlotsDto,
} from "../dto/booking.dto";
import {
  TimeSlotResponseDto,
  ErrorResponseDto,
  DeleteResponseDto,
  CleanupResponseDto,
} from "../dto/booking-response.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Таймслоты")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("time-slots")
export class TimeSlotsController {
  constructor(private readonly timeSlotsService: TimeSlotsService) {}

  @Post()
  @ApiOperation({ summary: "Создать таймслот" })
  @ApiResponse({
    status: 201,
    description: "Таймслот создан",
    schema: {
      $ref: getSchemaPath(TimeSlotResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async create(
    @Body() createTimeSlotDto: CreateTimeSlotDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.create(createTimeSlotDto, botId);
  }

  @Post("generate")
  @ApiOperation({ summary: "Сгенерировать таймслоты" })
  @ApiResponse({
    status: 201,
    description: "Таймслоты сгенерированы",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(TimeSlotResponseDto),
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async generate(
    @Body() generateTimeSlotsDto: GenerateTimeSlotsDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.generateTimeSlots(generateTimeSlotsDto, botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список таймслотов" })
  @ApiResponse({
    status: 200,
    description: "Список таймслотов получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(TimeSlotResponseDto),
      },
    },
  })
  async findAll(@Query("botId") botId: string, @Request() req) {
    return this.timeSlotsService.findAll(botId);
  }

  @Get("specialist/:specialistId")
  @ApiOperation({ summary: "Получить таймслоты специалиста" })
  @ApiResponse({
    status: 200,
    description: "Таймслоты специалиста получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(TimeSlotResponseDto),
      },
    },
  })
  async findBySpecialist(
    @Param("specialistId") specialistId: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.findBySpecialist(specialistId, botId);
  }

  @Get("preview")
  @ApiOperation({ summary: "Предпросмотр таймслотов (виртуальные + реальные)" })
  @ApiResponse({
    status: 200,
    description: "Таймслоты получены",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(TimeSlotResponseDto),
      },
    },
  })
  async previewSlots(
    @Query("specialistId") specialistId: string,
    @Query("date") date: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.previewTimeSlots(specialistId, date, botId);
  }

  @Get("available")
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
  async getAvailable(
    @Query() query: GetAvailableSlotsDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.findAvailableSlots(query, botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить таймслот по ID" })
  @ApiResponse({
    status: 200,
    description: "Таймслот найден",
    schema: {
      $ref: getSchemaPath(TimeSlotResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Таймслот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async findOne(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.findOne(id, botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить таймслот" })
  @ApiResponse({
    status: 200,
    description: "Таймслот обновлен",
    schema: {
      $ref: getSchemaPath(TimeSlotResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Таймслот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async update(
    @Param("id") id: string,
    @Body() updateTimeSlotDto: UpdateTimeSlotDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.timeSlotsService.update(id, updateTimeSlotDto, botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить таймслот" })
  @ApiResponse({
    status: 200,
    description: "Таймслот удален",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Таймслот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async remove(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    await this.timeSlotsService.remove(id, botId);
    return { message: "Таймслот удален" };
  }

  @Post("cleanup")
  @ApiOperation({ summary: "Очистить прошедшие таймслоты" })
  @ApiResponse({
    status: 200,
    description: "Прошедшие таймслоты очищены",
    schema: {
      $ref: getSchemaPath(CleanupResponseDto),
    },
  })
  async cleanup() {
    const count = await this.timeSlotsService.cleanupPastSlots();
    return { message: `Удалено ${count} прошедших таймслотов` };
  }
}
