import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { CustomPagesService } from "../services/custom-pages.service";
import { PublicCustomPageResponseDto } from "../dto/custom-page-response.dto";

@ApiTags("Публичные кастомные страницы")
@Controller("public/custom-pages")
export class PublicCustomPagesController {
  constructor(private readonly customPagesService: CustomPagesService) {}

  @Get(":identifier")
  @ApiOperation({
    summary: "Получить публичную страницу по ID или slug",
    description:
      "Автоматически определяет тип идентификатора: если это UUID — ищет по ID, иначе — по slug",
  })
  @ApiParam({
    name: "identifier",
    description: "ID (UUID) или slug страницы",
    examples: {
      uuid: {
        summary: "По ID",
        value: "123e4567-e89b-12d3-a456-426614174000",
      },
      slug: {
        summary: "По slug",
        value: "contacts",
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Страница найдена",
    type: PublicCustomPageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Страница не найдена",
  })
  async getPublicPage(
    @Param("identifier") identifier: string
  ): Promise<PublicCustomPageResponseDto> {
    return this.customPagesService.getPublicPage(identifier);
  }
}
