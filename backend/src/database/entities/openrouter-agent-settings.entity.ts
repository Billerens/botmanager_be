import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";

/**
 * Глобальные настройки выдачи моделей OpenRouter для ИИ-агентов:
 * - отключённые модели (не показывать в списке и не принимать в запросах);
 * - лимит по стоимости за 1M токенов (модели дороже — не показывать).
 */
@Entity("openrouter_agent_settings")
export class OpenRouterAgentSettings {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** ID моделей, отключённых для ИИ-агентов */
  @Column("simple-array", { default: "" })
  disabledModelIds: string[];

  /** Макс. цена за 1M токенов ($). Модели с ценой prompt или completion выше — не отображать. NULL = без лимита */
  @Column("decimal", {
    precision: 10,
    scale: 6,
    nullable: true,
  })
  maxCostPerMillion: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
