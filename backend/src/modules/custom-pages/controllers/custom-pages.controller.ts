import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  getSchemaPath,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CustomPagesService } from "../services/custom-pages.service";
import {
  CreateCustomPageDto,
  UpdateCustomPageDto,
} from "../dto/custom-page.dto";
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
    @Body() createCustomPageDto: CreateCustomPageDto
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
  async findAll(
    @Param("botId") botId: string
  ): Promise<CustomPageResponseDto[]> {
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
    @Param("id") id: string
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
    @Body() updateCustomPageDto: UpdateCustomPageDto
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
  async remove(
    @Param("botId") botId: string,
    @Param("id") id: string
  ): Promise<void> {
    return this.customPagesService.remove(botId, id);
  }

  @Post(":id/upload-bundle")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 150 * 1024 * 1024, // 150MB максимум
      },
      fileFilter: (_req, file, callback) => {
        if (
          file.mimetype === "application/zip" ||
          file.mimetype === "application/x-zip-compressed" ||
          file.originalname.endsWith(".zip")
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException("Разрешены только ZIP файлы"),
            false
          );
        }
      },
    })
  )
  @ApiOperation({
    summary: "Загрузить ZIP-архив с бандлом для static страницы",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "ZIP-архив с бандлом (index.html, CSS, JS, изображения)",
        },
      },
      required: ["file"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Бандл загружен",
    schema: {
      $ref: getSchemaPath(CustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверный формат файла",
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async uploadBundle(
    @Param("botId") botId: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<CustomPageResponseDto> {
    if (!file) {
      throw new BadRequestException("Файл не был загружен");
    }

    return this.customPagesService.uploadBundle(botId, id, file.buffer);
  }
}
