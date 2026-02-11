import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FlowTemplateCategory } from "../../database/entities/flow-template-category.entity";
import { UpsertCategoryDto } from "./dto/upsert-category.dto";

@Injectable()
export class FlowTemplateCategoriesService {
  constructor(
    @InjectRepository(FlowTemplateCategory)
    private categoryRepository: Repository<FlowTemplateCategory>
  ) {}

  /** Публичный: активные категории для фильтров */
  async getActiveCategories(): Promise<FlowTemplateCategory[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /** Админ: все категории */
  async getAllCategories(): Promise<FlowTemplateCategory[]> {
    return this.categoryRepository.find({
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  async createCategory(dto: UpsertCategoryDto): Promise<FlowTemplateCategory> {
    const category = this.categoryRepository.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    dto: UpsertCategoryDto
  ): Promise<FlowTemplateCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException("Категория не найдена");
    }

    Object.assign(category, {
      slug: dto.slug ?? category.slug,
      name: dto.name ?? category.name,
      description: dto.description !== undefined ? dto.description : category.description,
      icon: dto.icon !== undefined ? dto.icon : category.icon,
      isActive: dto.isActive !== undefined ? dto.isActive : category.isActive,
      sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : category.sortOrder,
    });

    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException("Категория не найдена");
    }
    // Soft delete — помечаем неактивной
    category.isActive = false;
    await this.categoryRepository.save(category);
  }
}
