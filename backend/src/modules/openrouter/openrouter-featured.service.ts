import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenRouterFeaturedModel } from "../../database/entities/openrouter-featured-model.entity";

@Injectable()
export class OpenRouterFeaturedService {
  constructor(
    @InjectRepository(OpenRouterFeaturedModel)
    private readonly repo: Repository<OpenRouterFeaturedModel>
  ) {}

  /**
   * Возвращает список ID моделей, отмеченных как "выбор платформы", в порядке sortOrder.
   */
  async getFeaturedModelIds(): Promise<string[]> {
    const rows = await this.repo.find({
      order: { sortOrder: "ASC", createdAt: "ASC" },
      select: ["modelId"],
    });
    return rows.map((r) => r.modelId);
  }

  /**
   * Заменяет список моделей "выбор платформы". Порядок = порядок в массиве.
   */
  async setFeaturedModels(modelIds: string[]): Promise<void> {
    await this.repo.clear();
    if (modelIds.length === 0) return;
    const entities = modelIds.map((modelId, index) =>
      this.repo.create({ modelId, sortOrder: index })
    );
    await this.repo.save(entities);
  }
}
