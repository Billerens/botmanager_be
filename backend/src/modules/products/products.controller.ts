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
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "./dto/product.dto";
import {
  ProductResponseDto,
  ProductStatsResponseDto,
  ErrorResponseDto,
  UpdateStockResponseDto,
  ToggleActiveResponseDto,
  DeleteResponseDto,
} from "./dto/product-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";

@ApiTags("Продукты")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@Controller("bots/:botId/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: "Создать товар" })
  @ApiResponse({
    status: 201,
    description: "Товар успешно создан",
    schema: {
      $ref: getSchemaPath(ProductResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.CREATE)
  create(
    @Param("botId") botId: string,
    @Request() req: any,
    @Body(new ValidationPipe({ transform: true }))
    createProductDto: CreateProductDto
  ) {
    return this.productsService.create(botId, req.user.id, createProductDto);
  }

  @Get()
  @ApiOperation({ summary: "Получить список товаров бота" })
  @ApiResponse({
    status: 200,
    description: "Список товаров получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(ProductResponseDto),
      },
    },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.READ)
  findAll(
    @Param("botId") botId: string,
    @Request() req: any,
    @Query(new ValidationPipe({ transform: true })) filters: ProductFiltersDto
  ) {
    return this.productsService.findAll(botId, req.user.id, filters);
  }

  @Get("stats")
  @ApiOperation({ summary: "Получить статистику товаров бота" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: {
      $ref: getSchemaPath(ProductStatsResponseDto),
    },
  })
  getStats(@Param("botId") botId: string, @Request() req: any) {
    return this.productsService.getBotProductStats(botId, req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить товар по ID" })
  @ApiResponse({
    status: 200,
    description: "Товар найден",
    schema: {
      $ref: getSchemaPath(ProductResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.READ)
  findOne(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.productsService.findOne(id, botId, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить товар" })
  @ApiResponse({
    status: 200,
    description: "Товар обновлен",
    schema: {
      $ref: getSchemaPath(ProductResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.UPDATE)
  update(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any,
    @Body(new ValidationPipe({ transform: true }))
    updateProductDto: UpdateProductDto
  ) {
    return this.productsService.update(
      id,
      botId,
      req.user.id,
      updateProductDto
    );
  }

  @Patch(":id/stock")
  @ApiOperation({ summary: "Обновить количество товара на складе" })
  @ApiResponse({
    status: 200,
    description: "Количество обновлено",
    schema: {
      $ref: getSchemaPath(UpdateStockResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.UPDATE)
  updateStock(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: { quantity: number }
  ) {
    return this.productsService.updateStock(
      id,
      botId,
      req.user.id,
      body.quantity
    );
  }

  @Patch(":id/toggle-active")
  @ApiOperation({ summary: "Переключить активность товара" })
  @ApiResponse({
    status: 200,
    description: "Активность переключена",
    schema: {
      $ref: getSchemaPath(ToggleActiveResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.UPDATE)
  toggleActive(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.productsService.toggleActive(id, botId, req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить товар" })
  @ApiResponse({
    status: 204,
    description: "Товар удален",
    schema: {
      $ref: getSchemaPath(DeleteResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Товар не найден",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.DELETE)
  remove(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.productsService.remove(id, botId, req.user.id);
  }
}
