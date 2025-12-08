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
import { PublicAccessGuard } from "../public-auth/guards/public-access.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";
import { OrderStatus } from "../../database/entities/order.entity";

/**
 * Идентификатор пользователя для заказов
 */
interface OrderUserIdentifier {
  telegramUsername?: string;
  publicUserId?: string;
}

@ApiTags("Публичные эндпоинты - Заказы")
@Controller("public")
@UseGuards(PublicAccessGuard)
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Получить идентификатор пользователя из request
   */
  private getUserIdentifier(req: any): OrderUserIdentifier {
    if (req.authType === "telegram" && req.telegramUser?.username) {
      return { telegramUsername: req.telegramUser.username };
    }
    if (req.authType === "browser" && req.publicUser?.id) {
      return { publicUserId: req.publicUser.id };
    }
    throw new UnauthorizedException("Не удалось определить пользователя");
  }

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
    description: "Требуется авторизация",
  })
  async createOrder(
    @Param("botId") botId: string,
    @Request() req,
    @Body() createOrderDto: CreateOrderDto
  ) {
    const userIdentifier = this.getUserIdentifier(req);
    return this.ordersService.createOrderByUser(
      botId,
      userIdentifier,
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
    description: "Требуется авторизация",
  })
  async getOrders(@Param("botId") botId: string, @Request() req) {
    const userIdentifier = this.getUserIdentifier(req);
    return this.ordersService.getOrdersByUserIdentifier(botId, userIdentifier);
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
    description: "Требуется авторизация",
  })
  async getOrder(
    @Param("botId") botId: string,
    @Param("orderId") orderId: string,
    @Request() req
  ) {
    const userIdentifier = this.getUserIdentifier(req);
    return this.ordersService.getOrderByUser(botId, orderId, userIdentifier);
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
  @ApiQuery({
    name: "searchUser",
    required: false,
    type: String,
    description: "Поиск по имени пользователя (telegramUsername или publicUserId)",
  })
  @ApiQuery({
    name: "searchProduct",
    required: false,
    type: String,
    description: "Поиск по названию товара",
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
    @Query("status") status?: OrderStatus,
    @Query("searchUser") searchUser?: string,
    @Query("searchProduct") searchProduct?: string
  ) {
    return this.ordersService.getOrdersByBotId(botId, status, searchUser, searchProduct);
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
