import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";
import { OpenRouterService } from "../../../common/openrouter.service";
import { OpenRouterFeaturedService } from "../../openrouter/openrouter-featured.service";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { ModelsListResponseDto } from "../../../common/dto/openrouter.dto";

export class SetFeaturedModelsDto {
  @ApiProperty({
    description: "Массив ID моделей OpenRouter в порядке отображения",
    example: ["meta-llama/llama-3.3-70b-instruct", "anthropic/claude-3.5-sonnet"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  modelIds: string[];
}

@ApiTags("Admin OpenRouter")
@Controller("admin/openrouter")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@ApiBearerAuth()
export class AdminOpenRouterController {
  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly openRouterFeaturedService: OpenRouterFeaturedService
  ) {}

  @Get("models")
  @ApiOperation({
    summary: "Список всех моделей OpenRouter",
    description: "Для админки: полный список моделей для настройки «выбор платформы»",
  })
  @ApiResponse({ status: 200, description: "Список моделей" })
  async getAllModels(): Promise<ModelsListResponseDto> {
    return this.openRouterService.getModels();
  }

  @Get("featured-models")
  @ApiOperation({
    summary: "Список ID моделей «выбор платформы»",
  })
  @ApiResponse({ status: 200, description: "Массив modelId" })
  async getFeaturedModels(): Promise<{ modelIds: string[] }> {
    const modelIds = await this.openRouterFeaturedService.getFeaturedModelIds();
    return { modelIds };
  }

  @Put("featured-models")
  @ApiOperation({
    summary: "Задать модели «выбор платформы»",
    description: "Передайте массив modelId в нужном порядке (порядок = порядок в списке на фронте)",
  })
  @ApiResponse({ status: 200, description: "OK" })
  async setFeaturedModels(
    @Body() body: SetFeaturedModelsDto
  ): Promise<{ modelIds: string[] }> {
    const modelIds = Array.isArray(body.modelIds) ? body.modelIds : [];
    await this.openRouterFeaturedService.setFeaturedModels(modelIds);
    return { modelIds };
  }
}
