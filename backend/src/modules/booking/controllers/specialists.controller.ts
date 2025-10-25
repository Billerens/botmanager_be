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
import { SpecialistsService } from "../services/specialists.service";
import { CreateSpecialistDto, UpdateSpecialistDto } from "../dto/booking.dto";
import {
  SpecialistResponseDto,
  ErrorResponseDto,
  DeleteResponseDto,
  ScheduleResponseDto,
} from "../dto/booking-response.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Специалисты")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("specialists")
export class SpecialistsController {
  constructor(private readonly specialistsService: SpecialistsService) {}

  @Post()
  @ApiOperation({ summary: "Создать специалиста" })
  @ApiResponse({
    status: 201,
    description: "Специалист создан",
    schema: {
      $ref: getSchemaPath(SpecialistResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async create(
    @Body() createSpecialistDto: CreateSpecialistDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.create(createSpecialistDto, botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список специалистов" })
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
  async findAll(@Query("botId") botId: string, @Request() req) {
    return this.specialistsService.findAll(botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить специалиста по ID" })
  @ApiResponse({
    status: 200,
    description: "Специалист найден",
    schema: {
      $ref: getSchemaPath(SpecialistResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Специалист не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async findOne(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.findOne(id, botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить специалиста" })
  @ApiResponse({
    status: 200,
    description: "Специалист обновлен",
    schema: {
      $ref: getSchemaPath(SpecialistResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Специалист не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async update(
    @Param("id") id: string,
    @Body() updateSpecialistDto: UpdateSpecialistDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.update(id, updateSpecialistDto, botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить специалиста" })
  @ApiResponse({
    status: 200,
    description: "Специалист удален",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Специалист не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async remove(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    await this.specialistsService.remove(id, botId);
    return { message: "Специалист удален" };
  }

  @Get(":id/schedule")
  @ApiOperation({ summary: "Получить расписание специалиста" })
  @ApiResponse({
    status: 200,
    description: "Расписание получено",
    schema: {
      $ref: getSchemaPath(ScheduleResponseDto),
    },
  })
  async getSchedule(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.getWorkingHours(id, botId);
  }

  @Put(":id/schedule")
  @ApiOperation({ summary: "Обновить расписание специалиста" })
  @ApiResponse({
    status: 200,
    description: "Расписание обновлено",
    schema: {
      $ref: getSchemaPath(ScheduleResponseDto),
    },
  })
  async updateSchedule(
    @Param("id") id: string,
    @Body() workingHours: any,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.updateWorkingHours(id, workingHours, botId);
  }

  @Get(":id/schedule/:date")
  @ApiOperation({ summary: "Получить расписание специалиста на день" })
  @ApiResponse({
    status: 200,
    description: "Расписание на день получено",
    schema: {
      $ref: getSchemaPath(ScheduleResponseDto),
    },
  })
  async getScheduleForDay(
    @Param("id") id: string,
    @Param("date") date: string,
    @Request() req
  ) {
    const targetDate = new Date(date);
    return this.specialistsService.getScheduleForDay(id, targetDate);
  }
}
