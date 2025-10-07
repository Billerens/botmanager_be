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
import { User } from './user.entity';
import { Message } from './message.entity';
import { Lead } from './lead.entity';
import { BotFlow } from './bot-flow.entity';
import { ActivityLog } from './activity-log.entity';

export enum BotStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ unique: true })
  token: string; // Зашифрованный токен

  @Column({ unique: true })
  username: string; // @botname

  @Column({
    type: 'enum',
    enum: BotStatus,
    default: BotStatus.INACTIVE,
  })
  status: BotStatus;

  @Column({ default: 0 })
  totalUsers: number;

  @Column({ default: 0 })
  totalMessages: number;

  @Column({ default: 0 })
  totalLeads: number;

  @Column({ nullable: true })
  webhookUrl: string;

  @Column({ default: false })
  isWebhookSet: boolean;

  @Column({ nullable: true })
  lastError: string;

  @Column({ nullable: true })
  lastErrorAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.bots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @OneToMany(() => Message, (message) => message.bot)
  messages: Message[];

  @OneToMany(() => Lead, (lead) => lead.bot)
  leads: Lead[];

  @OneToMany(() => BotFlow, (flow) => flow.bot)
  flows: BotFlow[];

  @OneToMany(() => ActivityLog, (log) => log.bot)
  activityLogs: ActivityLog[];

  // Методы
  get isActive(): boolean {
    return this.status === BotStatus.ACTIVE;
  }

  get hasError(): boolean {
    return this.status === BotStatus.ERROR;
  }
}
