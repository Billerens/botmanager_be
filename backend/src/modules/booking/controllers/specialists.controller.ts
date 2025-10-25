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
import { SpecialistsService } from "../services/specialists.service";
import { CreateSpecialistDto, UpdateSpecialistDto } from "../dto/booking.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Специалисты")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("specialists")
export class SpecialistsController {
  constructor(private readonly specialistsService: SpecialistsService) {}

  @Post()
  @ApiOperation({ summary: "Создать специалиста" })
  @ApiResponse({ status: 201, description: "Специалист создан" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async create(
    @Body() createSpecialistDto: CreateSpecialistDto,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.create(createSpecialistDto, botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список специалистов" })
  @ApiResponse({ status: 200, description: "Список специалистов получен" })
  async findAll(@Query("botId") botId: string, @Request() req) {
    return this.specialistsService.findAll(botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить специалиста по ID" })
  @ApiResponse({ status: 200, description: "Специалист найден" })
  @ApiResponse({ status: 404, description: "Специалист не найден" })
  async findOne(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.findOne(id, botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить специалиста" })
  @ApiResponse({ status: 200, description: "Специалист обновлен" })
  @ApiResponse({ status: 404, description: "Специалист не найден" })
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
  @ApiResponse({ status: 200, description: "Специалист удален" })
  @ApiResponse({ status: 404, description: "Специалист не найден" })
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
  @ApiResponse({ status: 200, description: "Расписание получено" })
  async getSchedule(
    @Param("id") id: string,
    @Query("botId") botId: string,
    @Request() req
  ) {
    return this.specialistsService.getWorkingHours(id, botId);
  }

  @Put(":id/schedule")
  @ApiOperation({ summary: "Обновить расписание специалиста" })
  @ApiResponse({ status: 200, description: "Расписание обновлено" })
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
  @ApiResponse({ status: 200, description: "Расписание на день получено" })
  async getScheduleForDay(
    @Param("id") id: string,
    @Param("date") date: string,
    @Request() req
  ) {
    const targetDate = new Date(date);
    return this.specialistsService.getScheduleForDay(id, targetDate);
  }
}
