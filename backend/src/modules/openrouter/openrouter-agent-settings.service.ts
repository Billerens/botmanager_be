import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenRouterAgentSettings } from "../../database/entities/openrouter-agent-settings.entity";

export interface OpenRouterAgentSettingsDto {
  disabledModelIds: string[];
  maxCostPerMillion: number | null;
}

@Injectable()
export class OpenRouterAgentSettingsService {
  constructor(
    @InjectRepository(OpenRouterAgentSettings)
    private readonly repo: Repository<OpenRouterAgentSettings>
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
}
