import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Bot } from './bot.entity';
import { BotFlowNode } from './bot-flow-node.entity';

export enum FlowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('bot_flows')
export class BotFlow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: FlowStatus,
    default: FlowStatus.DRAFT,
  })
  status: FlowStatus;

  @Column({ type: 'json' })
  flowData: {
    nodes: any[];
    edges: any[];
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
  };

  @Column({ default: false })
  isDefault: boolean; // Основной флоу для бота

  @Column({ nullable: true })
  triggerKeyword: string; // Ключевое слово для запуска флоу

  @Column({ type: 'json', nullable: true })
  conditions: {
    type: 'and' | 'or';
    rules: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
      value: string;
    }>;
  };

  @Column({ default: 0 })
  totalExecutions: number;

  @Column({ default: 0 })
  successfulExecutions: number;

  @Column({ default: 0 })
  failedExecutions: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, (bot) => bot.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column()
  botId: string;

  @OneToMany(() => BotFlowNode, (node) => node.flow)
  nodes: BotFlowNode[];

  // Методы
  get isActive(): boolean {
    return this.status === FlowStatus.ACTIVE;
  }

  get isDraft(): boolean {
    return this.status === FlowStatus.DRAFT;
  }

  get successRate(): number {
    if (this.totalExecutions === 0) return 0;
    return (this.successfulExecutions / this.totalExecutions) * 100;
  }

  get failureRate(): number {
    if (this.totalExecutions === 0) return 0;
    return (this.failedExecutions / this.totalExecutions) * 100;
  }
}
