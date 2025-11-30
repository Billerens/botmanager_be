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
import { CategoriesService } from "./categories.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryFiltersDto,
} from "./dto/category.dto";
import {
  CategoryResponseDto,
  CategoryTreeResponseDto,
  ErrorResponseDto,
} from "./dto/category-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";

@ApiTags("Категории товаров")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@Controller("bots/:botId/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: "Создать категорию" })
  @ApiResponse({
    status: 201,
    description: "Категория успешно создана",
    schema: {
      $ref: getSchemaPath(CategoryResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот или родительская категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.CREATE)
  create(
    @Param("botId") botId: string,
    @Request() req: any,
    @Body(new ValidationPipe({ transform: true }))
    createCategoryDto: CreateCategoryDto
  ) {
    return this.categoriesService.create(botId, req.user.id, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: "Получить список категорий бота" })
  @ApiResponse({
    status: 200,
    description: "Список категорий получен",
    type: [CategoryResponseDto],
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.READ)
  findAll(
    @Param("botId") botId: string,
    @Request() req: any,
    @Query(new ValidationPipe({ transform: true })) filters: CategoryFiltersDto
  ) {
    return this.categoriesService.findAll(botId, req.user.id, filters);
  }

  @Get("tree")
  @ApiOperation({ summary: "Получить дерево категорий бота" })
  @ApiResponse({
    status: 200,
    description: "Дерево категорий получено",
    type: [CategoryResponseDto],
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.READ)
  findTree(@Param("botId") botId: string, @Request() req: any) {
    return this.categoriesService.findTree(botId, req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить категорию по ID" })
  @ApiResponse({
    status: 200,
    description: "Категория найдена",
    schema: {
      $ref: getSchemaPath(CategoryResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.READ)
  findOne(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.categoriesService.findOne(id, botId, req.user.id);
  }

  @Get(":id/products")
  @ApiOperation({
    summary: "Получить товары категории",
    description:
      "Получить все товары категории, включая товары из подкатегорий",
  })
  @ApiResponse({
    status: 200,
    description: "Товары категории получены",
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.PRODUCTS, PermissionAction.READ)
  getCategoryProducts(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any,
    @Query("includeSubcategories") includeSubcategories?: string
  ) {
    const include = includeSubcategories !== "false";
    return this.categoriesService.getCategoryProducts(
      id,
      botId,
      req.user.id,
      include
    );
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Получить статистику по категории" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.READ)
  getCategoryStats(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.categoriesService.getCategoryStats(id, botId, req.user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить категорию" })
  @ApiResponse({
    status: 200,
    description: "Категория обновлена",
    schema: {
      $ref: getSchemaPath(CategoryResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.UPDATE)
  update(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any,
    @Body(new ValidationPipe({ transform: true }))
    updateCategoryDto: UpdateCategoryDto
  ) {
    return this.categoriesService.update(
      id,
      botId,
      req.user.id,
      updateCategoryDto
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Удалить категорию" })
  @ApiResponse({
    status: 204,
    description: "Категория удалена",
  })
  @ApiResponse({
    status: 400,
    description: "Невозможно удалить категорию (есть подкатегории или товары)",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: "Категория не найдена",
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @BotPermission(BotEntity.CATEGORIES, PermissionAction.DELETE)
  remove(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Request() req: any
  ) {
    return this.categoriesService.remove(id, botId, req.user.id);
  }
}

