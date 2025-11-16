import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";
import { BotFlow } from "./bot-flow.entity";

export enum GroupSessionStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

@Entity("group_sessions")
@Index(["botId", "status"])
@Index(["flowId"])
@Index(["status", "updatedAt"])
export class GroupSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  flowId: string;

  @ManyToOne(() => BotFlow, { onDelete: "CASCADE" })
  @JoinColumn({ name: "flowId" })
  flow: BotFlow;

  @Column({ nullable: true })
  currentNodeId: string; // Общая позиция в flow для всей группы

  @Column({ type: "jsonb", default: {} })
  sharedVariables: Record<string, any>; // Общие переменные для всех участников

  @Column({ type: "simple-array" })
  participantIds: string[]; // Массив userId участников

  @Column({ type: "jsonb", nullable: true })
  metadata: {
    createdBy?: string; // userId создателя
    maxSize?: number; // Максимальный размер группы
    [key: string]: any; // Любые пользовательские данные
  };

  @Column({
    type: "enum",
    enum: GroupSessionStatus,
    default: GroupSessionStatus.ACTIVE,
  })
  status: GroupSessionStatus;

  @Column({ nullable: true })
  startedAt: Date; // Когда группа начала выполнение flow

  @Column({ nullable: true })
  completedAt: Date; // Когда группа завершила выполнение

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Методы
  get isActive(): boolean {
    return this.status === GroupSessionStatus.ACTIVE;
  }

  get isCompleted(): boolean {
    return this.status === GroupSessionStatus.COMPLETED;
  }

  get isArchived(): boolean {
    return this.status === GroupSessionStatus.ARCHIVED;
  }

  get participantCount(): number {
    return this.participantIds?.length || 0;
  }

  get isFull(): boolean {
    const maxSize = this.metadata?.maxSize || 10000;
    return this.participantCount >= maxSize;
  }

  get canAcceptParticipants(): boolean {
    return this.isActive && !this.isFull;
  }

  hasParticipant(userId: string): boolean {
    return this.participantIds?.includes(userId) || false;
  }
}

