import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

/**
 * Модели OpenRouter, отмеченные как "Выбор платформы".
 * Отображаются в верхней части списка выбора модели со звёздочкой.
 */
@Entity("openrouter_featured_models")
export class OpenRouterFeaturedModel {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  modelId: string;

  /** Порядок отображения в списке (меньше — выше) */
  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
