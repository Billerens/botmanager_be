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

export enum StylePresetTarget {
  SHOP = "shop",
  BOOKING = "booking",
}

export enum StylePresetStatus {
  DRAFT = "draft",
  PRIVATE = "private",
  PENDING_REVIEW = "pending_review",
  PUBLISHED = "published",
  REJECTED = "rejected",
  PENDING_DELETION = "pending_deletion",
  ARCHIVED = "archived",
}

@Entity("style_presets")
export class StylePreset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // --- Основное ---

  @Column({ length: 128 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: StylePresetTarget })
  target: StylePresetTarget; // 'shop' | 'booking'

  @Column({ type: "text", array: true, default: "{}" })
  tags: string[];

  // --- Содержимое ---

  @Column({ type: "text" })
  cssData: string; // Кастомные CSS-стили (≤ 750 KB)

  // --- Публикация ---

  @Column({
    type: "enum",
    enum: StylePresetStatus,
    default: StylePresetStatus.DRAFT,
  })
  status: StylePresetStatus;

  @Column({ default: false })
  isPlatformChoice: boolean; // Помечен админом как «Выбор платформы»

  @Column({ nullable: true })
  rejectionReason: string; // Причина отклонения (заполняет админ)

  @Column({ type: "text", nullable: true })
  deletionRequestReason: string; // Причина запроса на удаление (заполняет автор)

  // --- Автор ---

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column({ type: "uuid", nullable: true })
  authorId: string | null; // null = системный / созданный админом

  // --- Метаданные ---

  @Column({ type: "int", default: 0 })
  usageCount: number; // Сколько раз применён

  @Column({ type: "int", default: 0 })
  sortOrder: number; // Порядок в галерее

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date; // Дата публикации

  @Column({ type: "timestamp", nullable: true })
  archivedAt: Date; // Дата архивации (soft delete)
}
