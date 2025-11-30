import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { TelegramInitDataGuard } from "../auth/guards/telegram-initdata.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";
import { OrderStatus } from "../../database/entities/order.entity";

@ApiTags("Публичные эндпоинты - Заказы")
@Controller("public")
@UseGuards(TelegramInitDataGuard)
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("bots/:botId/orders")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Оформить заказ из корзины" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 201,
    description: "Заказ успешно создан",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные или корзина пуста",
  })
  @ApiResponse({
    status: 404,
    description: "Бот или корзина не найдены",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async createOrder(
    @Param("botId") botId: string,
    @Request() req,
    @Body() createOrderDto: CreateOrderDto
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.ordersService.createOrder(
      botId,
      telegramUsername,
      createOrderDto
    );
  }

  @Get("bots/:botId/orders")
  @ApiOperation({ summary: "Получить все заказы пользователя" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiResponse({
    status: 200,
    description: "Список заказов получен",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async getOrders(@Param("botId") botId: string, @Request() req) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.ordersService.getOrdersByUser(botId, telegramUsername);
  }

  @Get("bots/:botId/orders/:orderId")
  @ApiOperation({ summary: "Получить заказ по ID" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 200,
    description: "Заказ получен",
  })
  @ApiResponse({
    status: 404,
    description: "Заказ не найден",
  })
  @ApiResponse({
    status: 401,
    description: "Неверный или устаревший initData",
  })
  async getOrder(
    @Param("botId") botId: string,
    @Param("orderId") orderId: string,
    @Request() req
  ) {
    const telegramUsername = req.telegramUsername;
    if (!telegramUsername) {
      throw new UnauthorizedException(
        "telegramUsername не найден в валидированных данных"
      );
    }
    return this.ordersService.getOrder(botId, orderId, telegramUsername);
  }
}

@ApiTags("Заказы (Админ)")
@Controller("bots/:botId/orders")
@UseGuards(JwtAuthGuard, BotPermissionGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "Получить все заказы бота (для админа)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: OrderStatus,
    description: "Фильтр по статусу заказа",
  })
  @ApiResponse({
    status: 200,
    description: "Список заказов получен",
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
  })
  @BotPermission(BotEntity.ORDERS, PermissionAction.READ)
  async getOrdersByBotId(
    @Param("botId") botId: string,
    @Query("status") status?: OrderStatus
  ) {
    return this.ordersService.getOrdersByBotId(botId, status);
  }

  @Patch(":orderId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Обновить статус заказа (для админа)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 200,
    description: "Статус заказа обновлен",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные или нельзя изменить статус",
  })
  @ApiResponse({
    status: 404,
    description: "Заказ не найден",
  })
  @BotPermission(BotEntity.ORDERS, PermissionAction.UPDATE)
  async updateOrderStatus(
    @Param("botId") botId: string,
    @Param("orderId") orderId: string,
    @Body() updateStatusDto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateOrderStatus(
      botId,
      orderId,
      updateStatusDto
    );
  }

  @Delete(":orderId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Удалить заказ (для админа)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 200,
    description: "Заказ удален",
  })
  @ApiResponse({
    status: 404,
    description: "Заказ не найден",
  })
  @BotPermission(BotEntity.ORDERS, PermissionAction.DELETE)
  async deleteOrder(
    @Param("botId") botId: string,
    @Param("orderId") orderId: string
  ) {
    await this.ordersService.deleteOrder(botId, orderId);
    return { message: "Заказ успешно удален" };
  }

  @Patch(":orderId/customer-data")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Обновить данные покупателя заказа (для админа)" })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "orderId", description: "ID заказа" })
  @ApiResponse({
    status: 200,
    description: "Данные покупателя обновлены",
  })
  @ApiResponse({
    status: 404,
    description: "Заказ не найден",
  })
  @BotPermission(BotEntity.ORDERS, PermissionAction.UPDATE)
  async updateOrderCustomerData(
    @Param("botId") botId: string,
    @Param("orderId") orderId: string,
    @Body() body: { customerData: any }
  ) {
    return this.ordersService.updateOrderCustomerData(
      botId,
      orderId,
      body.customerData
    );
  }
}
