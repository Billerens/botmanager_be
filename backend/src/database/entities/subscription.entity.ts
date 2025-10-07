import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum SubscriptionPlan {
  START = 'start',
  BUSINESS = 'business',
  PRO = 'pro',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  CLOUDPAYMENTS = 'cloudpayments',
  MANUAL = 'manual',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  paymentProvider: PaymentProvider;

  @Column({ nullable: true })
  externalSubscriptionId: string; // ID в платежной системе

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number; // Стоимость в долларах

  @Column()
  currency: string; // USD, EUR, RUB

  @Column({ type: 'date' })
  currentPeriodStart: Date;

  @Column({ type: 'date' })
  currentPeriodEnd: Date;

  @Column({ type: 'date', nullable: true })
  trialStart: Date;

  @Column({ type: 'date', nullable: true })
  trialEnd: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancelReason: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  // Методы
  get isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }

  get isTrial(): boolean {
    return this.status === SubscriptionStatus.TRIALING;
  }

  get isCancelled(): boolean {
    return this.status === SubscriptionStatus.CANCELLED;
  }

  get isExpired(): boolean {
    return this.status === SubscriptionStatus.EXPIRED;
  }

  get daysUntilExpiry(): number {
    const now = new Date();
    const diffTime = this.currentPeriodEnd.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get isExpiringSoon(): boolean {
    return this.daysUntilExpiry <= 7 && this.daysUntilExpiry > 0;
  }

  // Лимиты по планам
  get maxBots(): number {
    switch (this.plan) {
      case SubscriptionPlan.START:
        return 1;
      case SubscriptionPlan.BUSINESS:
        return 3;
      case SubscriptionPlan.PRO:
        return -1; // Неограниченно
      default:
        return 0;
    }
  }

  get maxUsers(): number {
    switch (this.plan) {
      case SubscriptionPlan.START:
        return 500;
      case SubscriptionPlan.BUSINESS:
        return 5000;
      case SubscriptionPlan.PRO:
        return 20000;
      default:
        return 0;
    }
  }

  get maxTeamMembers(): number {
    switch (this.plan) {
      case SubscriptionPlan.START:
        return 1;
      case SubscriptionPlan.BUSINESS:
        return 3;
      case SubscriptionPlan.PRO:
        return 10;
      default:
        return 0;
    }
  }

  get features(): string[] {
    const baseFeatures = [
      'basic_responses',
      'csv_export',
      'basic_analytics',
      'admin_panel',
    ];

    const businessFeatures = [
      ...baseFeatures,
      'advanced_responses',
      'message_chains',
      'group_chats',
      'realtime_updates',
      'priority_support',
    ];

    const proFeatures = [
      ...businessFeatures,
      'webhook_integrations',
      'advanced_analytics',
      'ai_assistant',
      'white_label',
    ];

    switch (this.plan) {
      case SubscriptionPlan.START:
        return baseFeatures;
      case SubscriptionPlan.BUSINESS:
        return businessFeatures;
      case SubscriptionPlan.PRO:
        return proFeatures;
      default:
        return [];
    }
  }
}
