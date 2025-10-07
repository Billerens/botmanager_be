import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Bot } from './bot.entity';
import { User } from './user.entity';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',
}

export enum LeadSource {
  TELEGRAM_BOT = 'telegram_bot',
  WEBSITE = 'website',
  REFERRAL = 'referral',
  ADVERTISING = 'advertising',
  OTHER = 'other',
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  telegramUserId: string;

  @Column({ nullable: true })
  telegramChatId: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'json' })
  formData: Record<string, any>; // Данные из форм

  @Column({
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  status: LeadStatus;

  @Column({
    type: 'enum',
    enum: LeadSource,
    default: LeadSource.TELEGRAM_BOT,
  })
  source: LeadSource;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ nullable: true })
  assignedToId: string;

  @Column({ nullable: true })
  priority: number; // 1-5, где 5 - высший приоритет

  @Column({ nullable: true })
  estimatedValue: number; // Оценочная стоимость заявки

  @Column({ nullable: true })
  closedAt: Date;

  @Column({ nullable: true })
  lastContactAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, (bot) => bot.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column()
  botId: string;

  @ManyToOne(() => User, (user) => user.leads, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  // Методы
  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username || 'Неизвестно';
  }

  get isNew(): boolean {
    return this.status === LeadStatus.NEW;
  }

  get isClosed(): boolean {
    return this.status === LeadStatus.CLOSED_WON || this.status === LeadStatus.CLOSED_LOST;
  }

  get isWon(): boolean {
    return this.status === LeadStatus.CLOSED_WON;
  }

  get isLost(): boolean {
    return this.status === LeadStatus.CLOSED_LOST;
  }
}
