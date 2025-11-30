import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { ShopPromocodesService } from "./shop-promocodes.service";
import {
  CreateShopPromocodeDto,
  UpdateShopPromocodeDto,
  ShopPromocodeFiltersDto,
} from "./dto/shop-promocode.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";

@ApiTags("Промокоды магазина")
@Controller("bots/:botId/shop-promocodes")
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@ApiBearerAuth()
export class ShopPromocodesController {
  constructor(
    private readonly shopPromocodesService: ShopPromocodesService
  ) {}

  @Post()
  @ApiOperation({ summary: "Создать промокод" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 201,
    description: "Промокод создан",
  })
  @BotPermission(BotEntity.SHOP_PROMOCODES, PermissionAction.CREATE)
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
  })
  async create(
    @Param("botId") botId: string,
    @Body() createDto: CreateShopPromocodeDto,
    @Request() req
  ) {
    return this.shopPromocodesService.create(
      { ...createDto, botId },
      req.user.id
    );
  }

  @Get()
  @ApiOperation({ summary: "Получить все промокоды бота" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Список промокодов",
  })
  @BotPermission(BotEntity.SHOP_PROMOCODES, PermissionAction.READ)
  async findAll(
    @Param("botId") botId: string,
    @Request() req,
    @Query(new ValidationPipe({ transform: true }))
    filters: ShopPromocodeFiltersDto
  ) {
    return this.shopPromocodesService.findAll(botId, req.user.id, filters);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить промокод по ID" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "id", description: "ID промокода" })
  @ApiResponse({
    status: 200,
    description: "Промокод найден",
  })
  @ApiResponse({
    status: 404,
    description: "Промокод не найден",
  })
  @BotPermission(BotEntity.SHOP_PROMOCODES, PermissionAction.READ)
  async findOne(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req
  ) {
    return this.shopPromocodesService.findOne(id, botId, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить промокод" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "id", description: "ID промокода" })
  @ApiResponse({
    status: 200,
    description: "Промокод обновлен",
  })
  @BotPermission(BotEntity.SHOP_PROMOCODES, PermissionAction.UPDATE)
  @ApiResponse({
    status: 400,
    description: "Неверные данные",
  })
  @ApiResponse({
    status: 404,
    description: "Промокод не найден",
  })
  async update(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Body() updateDto: UpdateShopPromocodeDto,
    @Request() req
  ) {
    return this.shopPromocodesService.update(id, botId, req.user.id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить промокод" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "id", description: "ID промокода" })
  @ApiResponse({
    status: 200,
    description: "Промокод удален",
  })
  @BotPermission(BotEntity.SHOP_PROMOCODES, PermissionAction.DELETE)
  @ApiResponse({
    status: 404,
    description: "Промокод не найден",
  })
  async remove(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req
  ) {
    await this.shopPromocodesService.remove(id, botId, req.user.id);
    return { message: "Промокод удален" };
  }
}

