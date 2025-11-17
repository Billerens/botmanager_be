import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CustomPagesService } from "../services/custom-pages.service";
import { CreateCustomPageDto, UpdateCustomPageDto } from "../dto/custom-page.dto";
import { CustomPageResponseDto } from "../dto/custom-page-response.dto";

@ApiTags("Кастомные страницы")
@Controller("bots/:botId/custom-pages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomPagesController {
  constructor(private readonly customPagesService: CustomPagesService) {}

  @Post()
  @ApiOperation({ summary: "Создать кастомную страницу для бота" })
  @ApiResponse({
    status: 201,
    description: "Страница создана",
    schema: {
      $ref: getSchemaPath(CustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Бот не найден",
  })
  @ApiResponse({
    status: 409,
    description: "Slug или команда уже используются",
  })
  async create(
    @Param("botId") botId: string,
    @Body() createCustomPageDto: CreateCustomPageDto,
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.create(botId, createCustomPageDto);
  }

  @Get()
  @ApiOperation({ summary: "Получить все кастомные страницы бота" })
  @ApiResponse({
    status: 200,
    description: "Список страниц получен",
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(CustomPageResponseDto) },
    },
  })
  async findAll(@Param("botId") botId: string): Promise<CustomPageResponseDto[]> {
    return this.customPagesService.findAll(botId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить кастомную страницу по ID" })
  @ApiResponse({
    status: 200,
    description: "Страница найдена",
    schema: {
      $ref: getSchemaPath(CustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async findOne(
    @Param("botId") botId: string,
    @Param("id") id: string,
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.findOne(botId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить кастомную страницу" })
  @ApiResponse({
    status: 200,
    description: "Страница обновлена",
    schema: {
      $ref: getSchemaPath(CustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  @ApiResponse({
    status: 409,
    description: "Slug или команда уже используются",
  })
  async update(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @Body() updateCustomPageDto: UpdateCustomPageDto,
  ): Promise<CustomPageResponseDto> {
    return this.customPagesService.update(botId, id, updateCustomPageDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить кастомную страницу" })
  @ApiResponse({
    status: 200,
    description: "Страница удалена",
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async remove(@Param("botId") botId: string, @Param("id") id: string): Promise<void> {
    return this.customPagesService.remove(botId, id);
  }
}
