import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum AiProviderType {
  OPENAI = "openai",
  OPENROUTER = "openrouter",
  ANTHROPIC = "anthropic",
  GOOGLE = "google",
  OLLAMA = "ollama",
  CUSTOM = "custom",
}

@Entity("ai_providers")
export class AiProvider {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: AiProviderType,
    default: AiProviderType.CUSTOM,
  })
  providerType: AiProviderType;

  @Column({ nullable: true })
  description: string;

  /**
   * Base URL API провайдера (OpenAI-compatible).
   * Примеры:
   * - OpenAI: https://api.openai.com/v1
   * - OpenRouter: https://openrouter.ai/api/v1
   * - Ollama: http://localhost:11434/v1
   */
  @Column({ nullable: true })
  baseUrl: string;

  /**
   * Зашифрованный API-ключ (через BotsService.encryptToken).
   * При ответе API клиенту ключ НЕ возвращается — только hasApiKey.
   */
  @Column({ nullable: true })
  apiKey: string;

  /**
   * Модель по умолчанию для этого профиля.
   * Может быть переопределена в узле ai_single/ai_chat через preferredModelId.
   * Примеры: "gpt-4o", "claude-3-5-sonnet", "gemma3:27b"
   */
  @Column({ nullable: true })
  defaultModel: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
