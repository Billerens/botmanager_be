import {
  Controller,
  Get,
  Query,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { Public } from "../auth/guards/jwt-auth.guard";
import { DomainResolverService } from "./domain-resolver.service";

@ApiTags("Domain Resolver")
@Controller("public/domain-resolver")
export class DomainResolverController {
  constructor(private readonly domainResolverService: DomainResolverService) {}

  /**
   * Публичный endpoint для резолва домена в ресурс
   * Используется фронтендом для определения какой магазин/страницу/букинг показать
   *
   * Пример: GET /api/public/domain-resolver/resolve?domain=shop.example.com
   * Возвращает: { type: 'shop', id: 'uuid', slug: 'my-shop' }
   */
  @Get("resolve")
  @Public()
  @ApiOperation({
    summary: "Резолв домена в ресурс (магазин/букинг/страницу)",
    description:
      "Определяет какой ресурс (магазин/система бронирования/страница) привязан к указанному домену",
  })
  @ApiQuery({
    name: "domain",
    description: "Полное доменное имя (например: shop.example.com)",
    example: "shop.example.com",
  })
  @ApiResponse({
    status: 200,
    description: "Домен успешно резолвнут",
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["shop", "booking", "custom_page"],
          description: "Тип ресурса",
        },
        id: {
          type: "string",
          format: "uuid",
          description: "ID ресурса",
        },
        slug: {
          type: "string",
          description: "Slug ресурса (если есть)",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Некорректный домен" })
  @ApiResponse({ status: 404, description: "Домен не найден или не активен" })
  async resolveDomain(@Query("domain") domain: string): Promise<{
    type: "shop" | "booking" | "custom_page";
    id: string;
    slug?: string;
  }> {
    if (!domain) {
      throw new BadRequestException("Параметр domain обязателен");
    }

    const normalizedDomain = domain.toLowerCase().trim();

    const result =
      await this.domainResolverService.resolveDomain(normalizedDomain);

    if (!result) {
      throw new NotFoundException(
        `Ресурс для домена ${normalizedDomain} не найден`
      );
    }

    return result;
  }
}
