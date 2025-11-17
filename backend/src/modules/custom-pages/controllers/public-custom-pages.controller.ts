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
@Controller("public")
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
    @Param("slug") slug: string,
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
  async getCustomPageById(@Param("id") id: string): Promise<PublicCustomPageResponseDto> {
    // Для публичного доступа по ID нужно найти страницу и проверить статус
    const page = await this.customPagesService.findOne("", id); // botId будет проверен в сервисе
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      content: page.content,
      botId: page.botId,
      botUsername: page.botUsername,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      url: page.url,
    };
  }
}
