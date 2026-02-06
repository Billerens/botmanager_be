import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenRouterAgentSettings } from "../../database/entities/openrouter-agent-settings.entity";
import { OpenRouterService } from "../../common/openrouter.service";
import { OpenRouterModelDto } from "../../common/dto/openrouter.dto";

export interface OpenRouterAgentSettingsDto {
  disabledModelIds: string[];
  maxCostPerMillion: number | null;
}

@Injectable()
export class OpenRouterAgentSettingsService {
  constructor(
    @InjectRepository(OpenRouterAgentSettings)
    private readonly repo: Repository<OpenRouterAgentSettings>,
    private readonly openRouterService: OpenRouterService
  ) {}

  private normalizeIds(ids: string[] | undefined): string[] {
    if (!Array.isArray(ids)) return [];
    return ids.filter((id) => typeof id === "string" && id.trim().length > 0);
  }

  /**
   * Возвращает единственную запись настроек (всегда одна строка в таблице).
   */
  async getSettings(): Promise<OpenRouterAgentSettingsDto> {
    let row = await this.repo.findOne({ where: {} });
    if (!row) {
      row = this.repo.create({
        disabledModelIds: [],
        maxCostPerMillion: null,
      });
      await this.repo.save(row);
    }
    const ids = Array.isArray(row.disabledModelIds)
      ? row.disabledModelIds
      : (row.disabledModelIds as unknown as string)?.split(",").filter(Boolean) ?? [];
    return {
      disabledModelIds: this.normalizeIds(ids),
      maxCostPerMillion: row.maxCostPerMillion != null ? Number(row.maxCostPerMillion) : null,
    };
  }

  /**
   * Обновляет настройки. Передайте только те поля, которые нужно изменить.
   */
  async setSettings(dto: Partial<OpenRouterAgentSettingsDto>): Promise<OpenRouterAgentSettingsDto> {
    let row = await this.repo.findOne({ where: {} });
    if (!row) {
      row = this.repo.create({
        disabledModelIds: [],
        maxCostPerMillion: null,
      });
      await this.repo.save(row);
    }
    if (dto.disabledModelIds !== undefined) {
      row.disabledModelIds = this.normalizeIds(dto.disabledModelIds) as any;
    }
    if (dto.maxCostPerMillion !== undefined) {
      row.maxCostPerMillion = dto.maxCostPerMillion;
    }
    await this.repo.save(row);
    return this.getSettings();
  }

  /**
   * Фильтрует модели по настройкам агентов (отключённые и выше лимита по стоимости).
   */
  private filterModelsForAgents(
    models: OpenRouterModelDto[],
    disabledIds: string[],
    maxCostPerMillion: number | null
  ): OpenRouterModelDto[] {
    const disabledSet = new Set(disabledIds);
    return models.filter((m) => {
      if (disabledSet.has(m.id)) return false;
      if (maxCostPerMillion != null && m.pricing) {
        const promptPerMillion =
          parseFloat(String(m.pricing.prompt || 0)) * 1e6;
        const completionPerMillion =
          parseFloat(String(m.pricing.completion || 0)) * 1e6;
        if (
          promptPerMillion > maxCostPerMillion ||
          completionPerMillion > maxCostPerMillion
        ) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Проверяет, разрешена ли модель для ИИ-агентов (не отключена и не выше лимита по стоимости).
   */
  async isModelAllowedForAgents(modelId: string): Promise<boolean> {
    if (!modelId || !modelId.trim()) return true;
    const [settings, paidResult] = await Promise.all([
      this.getSettings(),
      this.openRouterService.getPaidModels(),
    ]);
    const allowed = this.filterModelsForAgents(
      paidResult.data,
      settings.disabledModelIds,
      settings.maxCostPerMillion
    );
    return allowed.some((m) => m.id === modelId);
  }
}
