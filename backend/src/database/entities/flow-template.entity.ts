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
import { FlowTemplateCategory } from "./flow-template-category.entity";

export enum FlowTemplateType {
  FULL = "full",
  PARTIAL = "partial",
}

export enum FlowTemplateStatus {
  DRAFT = "draft",
  PRIVATE = "private",
  PENDING_REVIEW = "pending_review",
  PUBLISHED = "published",
  REJECTED = "rejected",
  PENDING_DELETION = "pending_deletion",
  ARCHIVED = "archived",
}

@Entity("flow_templates")
export class FlowTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // --- Основное ---

  @Column({ length: 128 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: FlowTemplateType })
  type: FlowTemplateType;

  @ManyToOne(() => FlowTemplateCategory, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category: FlowTemplateCategory;

  @Column({ type: "uuid", nullable: true })
  categoryId: string | null;

  @Column({ type: "text", array: true, default: "{}" })
  tags: string[];

  // --- Содержимое ---

  @Column({ type: "jsonb" })
  flowData: {
    nodes: any[];
    edges: any[];
    viewport?: { x: number; y: number; zoom: number };
  };

  // --- Публикация ---

  @Column({
    type: "enum",
    enum: FlowTemplateStatus,
    default: FlowTemplateStatus.DRAFT,
  })
  status: FlowTemplateStatus;

  @Column({ default: false })
  isPlatformChoice: boolean;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ type: "text", nullable: true })
  deletionRequestReason: string;

  // --- Автор ---

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column({ type: "uuid", nullable: true })
  authorId: string | null;

  @Column({ length: 255, nullable: true })
  originalAuthorName: string | null; // Имя автора для системной копии

  // --- Метаданные ---

  @Column({ type: "int", default: 0 })
  usageCount: number;

  @Column({ type: "int", default: 0 })
  nodeCount: number;

  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  archivedAt: Date;
}
