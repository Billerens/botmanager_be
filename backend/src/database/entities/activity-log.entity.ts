import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";
import { User } from "./user.entity";

export enum ActivityType {
  BOT_CREATED = "bot_created",
  BOT_UPDATED = "bot_updated",
  BOT_DELETED = "bot_deleted",
  BOT_ACTIVATED = "bot_activated",
  BOT_DEACTIVATED = "bot_deactivated",
  BOT_ERROR = "bot_error",

  MESSAGE_RECEIVED = "message_received",
  MESSAGE_SENT = "message_sent",
  MESSAGE_FAILED = "message_failed",

  LEAD_CREATED = "lead_created",
  LEAD_UPDATED = "lead_updated",
  LEAD_STATUS_CHANGED = "lead_status_changed",

  USER_REGISTERED = "user_registered",
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",

  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_UPDATED = "subscription_updated",
  SUBSCRIPTION_CANCELLED = "subscription_cancelled",

  FLOW_CREATED = "flow_created",
  FLOW_UPDATED = "flow_updated",
  FLOW_DELETED = "flow_deleted",
  FLOW_EXECUTED = "flow_executed",

  WEBHOOK_TRIGGERED = "webhook_triggered",
  WEBHOOK_FAILED = "webhook_failed",

  EXPORT_CSV = "export_csv",
  API_CALL = "api_call",
}

export enum ActivityLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
}

@Entity("activity_logs")
export class ActivityLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ActivityType,
  })
  type: ActivityType;

  @Column({
    type: "enum",
    enum: ActivityLevel,
    default: ActivityLevel.INFO,
  })
  level: ActivityLevel;

  @Column()
  message: string;

  @Column({ type: "json", nullable: true })
  metadata: {
    userId?: string;
    botId?: string;
    messageId?: string;
    leadId?: string;
    subscriptionId?: string;
    flowId?: string;
    nodeId?: string;
    webhookUrl?: string;
    errorMessage?: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  // Связи
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => Bot, { nullable: true })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column({ nullable: true })
  botId: string;

  // Методы
  get isError(): boolean {
    return this.level === ActivityLevel.ERROR;
  }

  get isWarning(): boolean {
    return this.level === ActivityLevel.WARNING;
  }

  get isSuccess(): boolean {
    return this.level === ActivityLevel.SUCCESS;
  }

  get isInfo(): boolean {
    return this.level === ActivityLevel.INFO;
  }

  get isBotRelated(): boolean {
    return this.botId !== null;
  }

  get isUserRelated(): boolean {
    return this.userId !== null;
  }

  get formattedMessage(): string {
    const timestamp = this.createdAt.toLocaleString("ru-RU");
    const level = this.level.toUpperCase();
    return `[${timestamp}] ${level}: ${this.message}`;
  }
}
