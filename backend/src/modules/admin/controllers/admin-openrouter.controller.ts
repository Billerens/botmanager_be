import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import { IsArray, IsString, IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { OpenRouterService } from "../../../common/openrouter.service";
import { OpenRouterFeaturedService } from "../../openrouter/openrouter-featured.service";
import {
  OpenRouterAgentSettingsService,
  OpenRouterAgentSettingsDto,
} from "../../openrouter/openrouter-agent-settings.service";
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

export class SetAgentSettingsDto {
  @ApiPropertyOptional({
    description: "ID моделей, отключённых для ИИ-агентов (не показывать в списке и не принимать в запросах)",
    example: ["anthropic/claude-3-opus"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledModelIds?: string[];

  @ApiPropertyOptional({
    description:
      "Макс. цена за 1M токенов ($). Модели с ценой prompt или completion выше — не отображать. null или не передавать = без лимита",
    example: 10,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCostPerMillion?: number | null;
}

@ApiTags("Admin OpenRouter")
@Controller("admin/openrouter")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@ApiBearerAuth()
export class AdminOpenRouterController {
  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly openRouterFeaturedService: OpenRouterFeaturedService,
    private readonly openRouterAgentSettingsService: OpenRouterAgentSettingsService
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

  @Get("agent-settings")
  @ApiOperation({
    summary: "Настройки выдачи моделей для ИИ-агентов",
    description:
      "Список отключённых моделей и лимит по стоимости за 1M токенов (модели дороже — не отображать)",
  })
  @ApiResponse({ status: 200, description: "Настройки агентов" })
  async getAgentSettings(): Promise<OpenRouterAgentSettingsDto> {
    return this.openRouterAgentSettingsService.getSettings();
  }

  @Put("agent-settings")
  @ApiOperation({
    summary: "Обновить настройки выдачи моделей для ИИ-агентов",
  })
  @ApiResponse({ status: 200, description: "Обновлённые настройки" })
  async setAgentSettings(
    @Body() body: SetAgentSettingsDto
  ): Promise<OpenRouterAgentSettingsDto> {
    return this.openRouterAgentSettingsService.setSettings({
      disabledModelIds: body.disabledModelIds,
      maxCostPerMillion: body.maxCostPerMillion,
    });
  }
}
