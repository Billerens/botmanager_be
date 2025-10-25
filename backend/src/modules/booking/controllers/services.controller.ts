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
import { ServicesService } from "../services/services.service";
import { CreateServiceDto, UpdateServiceDto } from "../dto/booking.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Услуги")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: "Создать услугу" })
  @ApiResponse({ status: 201, description: "Услуга создана" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  async create(@Body() createServiceDto: CreateServiceDto, @Request() req) {
    return this.servicesService.create(createServiceDto, req.user.botId);
  }

  @Get()
  @ApiOperation({ summary: "Получить список услуг" })
  @ApiResponse({ status: 200, description: "Список услуг получен" })
  async findAll(@Request() req) {
    return this.servicesService.findAll(req.user.botId);
  }

  @Get("specialist/:specialistId")
  @ApiOperation({ summary: "Получить услуги специалиста" })
  @ApiResponse({ status: 200, description: "Услуги специалиста получены" })
  async findBySpecialist(
    @Param("specialistId") specialistId: string,
    @Request() req
  ) {
    return this.servicesService.findBySpecialist(specialistId, req.user.botId);
  }

  @Get("category/:category")
  @ApiOperation({ summary: "Получить услуги по категории" })
  @ApiResponse({ status: 200, description: "Услуги по категории получены" })
  async getByCategory(@Param("category") category: string, @Request() req) {
    return this.servicesService.getServicesByCategory(req.user.botId, category);
  }

  @Get("popular")
  @ApiOperation({ summary: "Получить популярные услуги" })
  @ApiResponse({ status: 200, description: "Популярные услуги получены" })
  async getPopular(@Query("limit") limit: string, @Request() req) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.servicesService.getPopularServices(req.user.botId, limitNumber);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить услугу по ID" })
  @ApiResponse({ status: 200, description: "Услуга найдена" })
  @ApiResponse({ status: 404, description: "Услуга не найдена" })
  async findOne(@Param("id") id: string, @Request() req) {
    return this.servicesService.findOne(id, req.user.botId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить услугу" })
  @ApiResponse({ status: 200, description: "Услуга обновлена" })
  @ApiResponse({ status: 404, description: "Услуга не найдена" })
  async update(
    @Param("id") id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Request() req
  ) {
    return this.servicesService.update(id, updateServiceDto, req.user.botId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить услугу" })
  @ApiResponse({ status: 200, description: "Услуга удалена" })
  @ApiResponse({ status: 404, description: "Услуга не найдена" })
  async remove(@Param("id") id: string, @Request() req) {
    await this.servicesService.remove(id, req.user.botId);
    return { message: "Услуга удалена" };
  }
}
