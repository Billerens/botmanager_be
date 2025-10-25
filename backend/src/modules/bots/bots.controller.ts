import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
  getSchemaPath,
} from "@nestjs/swagger";

import { BotsService } from "./bots.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateBotDto, UpdateBotDto } from "./dto/bot.dto";
import { BotResponseDto, BotStatsResponseDto } from "./dto/bot-response.dto";

@ApiTags("Боты")
@Controller("bots")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  @ApiOperation({ summary: "Создать нового бота" })
  @ApiResponse({
    status: 201,
    description: "Бот успешно создан",
    schema: {
      $ref: getSchemaPath(BotResponseDto),
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные или токен" })
  async create(@Body() createBotDto: CreateBotDto, @Request() req) {
    return this.botsService.create(createBotDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "Получить список всех ботов пользователя" })
  @ApiResponse({
    status: 200,
    description: "Список ботов получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(BotResponseDto),
      },
    },
  })
  async findAll(@Request() req) {
    return this.botsService.findAll(req.user.id);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Получить статистику бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика бота получена",
    schema: {
      $ref: getSchemaPath(BotStatsResponseDto),
    },
  })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async getStats(@Param("id") id: string, @Request() req) {
    return this.botsService.getStats(id, req.user.id);
  }

  @Patch(":id/activate")
  @ApiOperation({ summary: "Активировать бота" })
  @ApiResponse({ status: 200, description: "Бот активирован" })
  @ApiResponse({
    status: 400,
    description: "Бот уже активен или ошибка активации",
  })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async activate(@Param("id") id: string, @Request() req) {
    return this.botsService.activate(id, req.user.id);
  }

  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Деактивировать бота" })
  @ApiResponse({ status: 200, description: "Бот деактивирован" })
  @ApiResponse({ status: 400, description: "Бот уже неактивен" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async deactivate(@Param("id") id: string, @Request() req) {
    return this.botsService.deactivate(id, req.user.id);
  }

  @Patch(":id/shop-settings")
  @ApiOperation({ summary: "Обновить настройки магазина бота" })
  @ApiResponse({ status: 200, description: "Настройки магазина обновлены" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async updateShopSettings(
    @Param("id") id: string,
    @Body()
    shopSettings: {
      isShop?: boolean;
      shopLogoUrl?: string;
      shopTitle?: string;
      shopDescription?: string;
      shopCustomStyles?: string;
      shopButtonTypes?: string[];
      shopButtonSettings?: Record<string, any>;
    },
    @Request() req
  ) {
    return this.botsService.updateShopSettings(id, shopSettings, req.user.id);
  }

  @Patch(":id/booking-settings")
  @ApiOperation({ summary: "Обновить настройки бронирования бота" })
  @ApiResponse({ status: 200, description: "Настройки бронирования обновлены" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async updateBookingSettings(
    @Param("id") id: string,
    @Body()
    bookingSettings: {
      isBookingEnabled?: boolean;
      bookingTitle?: string;
      bookingDescription?: string;
      bookingLogoUrl?: string;
      bookingCustomStyles?: string;
      bookingButtonTypes?: string[];
      bookingButtonSettings?: Record<string, any>;
      bookingSettings?: any;
    },
    @Request() req
  ) {
    return this.botsService.updateBookingSettings(
      id,
      bookingSettings,
      req.user.id
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить бота по ID" })
  @ApiResponse({ status: 200, description: "Бот найден" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async findOne(@Param("id") id: string, @Request() req) {
    return this.botsService.findOne(id, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить бота" })
  @ApiResponse({ status: 200, description: "Бот обновлен" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async update(
    @Param("id") id: string,
    @Body() updateBotDto: UpdateBotDto,
    @Request() req
  ) {
    return this.botsService.update(id, updateBotDto, req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить бота" })
  @ApiResponse({ status: 200, description: "Бот удален" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  async remove(@Param("id") id: string, @Request() req) {
    return this.botsService.remove(id, req.user.id);
  }
}
