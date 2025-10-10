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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
} from "./dto/product.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bots/:botId/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: "Создать товар" })
  @ApiResponse({ status: 201, description: "Товар успешно создан" })
  @ApiResponse({ status: 404, description: "Бот не найден" })
  create(
    @Param("botId") botId: string,
    @Request() req: any,
    @Body() createProductDto: CreateProductDto
  ) {
    return this.productsService.create(botId, req.user.id, createProductDto);
  }

  @Get()
  @ApiOperation({ summary: "Получить список товаров бота" })
  @ApiResponse({ status: 200, description: "Список товаров получен" })
  findAll(
    @Param("botId") botId: string,
    @Request() req: any,
    @Query() filters: ProductFiltersDto
  ) {
    return this.productsService.findAll(botId, req.user.id, filters);
  }

  @Get("stats")
  @ApiOperation({ summary: "Получить статистику товаров бота" })
  @ApiResponse({ status: 200, description: "Статистика получена" })
  getStats(@Param("botId") botId: string, @Request() req: any) {
    return this.productsService.getBotProductStats(botId, req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить товар по ID" })
  @ApiResponse({ status: 200, description: "Товар найден" })
  @ApiResponse({ status: 404, description: "Товар не найден" })
  findOne(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.productsService.findOne(id, botId, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить товар" })
  @ApiResponse({ status: 200, description: "Товар обновлен" })
  @ApiResponse({ status: 404, description: "Товар не найден" })
  update(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any,
    @Body() updateProductDto: UpdateProductDto
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
  @ApiResponse({ status: 200, description: "Количество обновлено" })
  @ApiResponse({ status: 404, description: "Товар не найден" })
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
  @ApiResponse({ status: 200, description: "Активность переключена" })
  @ApiResponse({ status: 404, description: "Товар не найден" })
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
  @ApiResponse({ status: 204, description: "Товар удален" })
  @ApiResponse({ status: 404, description: "Товар не найден" })
  remove(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.productsService.remove(id, botId, req.user.id);
  }
}
