import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { CustomPagesService } from "../services/custom-pages.service";
import { PublicCustomPageResponseDto } from "../dto/custom-page-response.dto";

@ApiTags("Публичные кастомные страницы")
@Controller("public/custom-pages")
export class PublicCustomPagesController {
  constructor(private readonly customPagesService: CustomPagesService) {}

  @Get(":botUsername/:slug")
  @ApiOperation({ summary: "Получить публичную кастомную страницу" })
  @ApiResponse({
    status: 200,
    description: "Страница найдена",
    schema: {
      $ref: getSchemaPath(PublicCustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async getCustomPage(
    @Param("botUsername") botUsername: string,
    @Param("slug") slug: string
  ): Promise<PublicCustomPageResponseDto> {
    return this.customPagesService.findBySlug(botUsername, slug);
  }

  @Get("pages/:id")
  @ApiOperation({ summary: "Получить публичную кастомную страницу по ID" })
  @ApiResponse({
    status: 200,
    description: "Страница найдена",
    schema: {
      $ref: getSchemaPath(PublicCustomPageResponseDto),
    },
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async getCustomPageById(
    @Param("id") id: string
  ): Promise<PublicCustomPageResponseDto> {
    // Для публичного доступа по ID используем прямой доступ через сервис
    const response = await this.customPagesService.getPublicPageById(id);
    return response;
  }
}
