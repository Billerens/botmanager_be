import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
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
  MESSAGE_DELETED = "message_deleted",
  MESSAGE_BROADCAST = "message_broadcast",

  LEAD_CREATED = "lead_created",
  LEAD_UPDATED = "lead_updated",
  LEAD_STATUS_CHANGED = "lead_status_changed",
  LEAD_DELETED = "lead_deleted",

  USER_REGISTERED = "user_registered",
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  USER_UPDATED = "user_updated",
  USER_ROLE_CHANGED = "user_role_changed",
  USER_DELETED = "user_deleted",
  USER_PASSWORD_RESET = "user_password_reset",
  USER_TELEGRAM_VERIFIED = "user_telegram_verified",
  USER_2FA_ENABLED = "user_2fa_enabled",
  USER_2FA_DISABLED = "user_2fa_disabled",

  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_UPDATED = "subscription_updated",
  SUBSCRIPTION_CANCELLED = "subscription_cancelled",

  FLOW_CREATED = "flow_created",
  FLOW_UPDATED = "flow_updated",
  FLOW_DELETED = "flow_deleted",
  FLOW_EXECUTED = "flow_executed",
  FLOW_ACTIVATED = "flow_activated",
  FLOW_DEACTIVATED = "flow_deactivated",
  NODE_EXECUTED = "node_executed",

  PRODUCT_CREATED = "product_created",
  PRODUCT_UPDATED = "product_updated",
  PRODUCT_DELETED = "product_deleted",
  PRODUCT_STOCK_UPDATED = "product_stock_updated",

  CATEGORY_CREATED = "category_created",
  CATEGORY_UPDATED = "category_updated",
  CATEGORY_DELETED = "category_deleted",

  ORDER_CREATED = "order_created",
  ORDER_UPDATED = "order_updated",
  ORDER_STATUS_CHANGED = "order_status_changed",
  ORDER_DELETED = "order_deleted",

  PROMOCODE_CREATED = "promocode_created",
  PROMOCODE_UPDATED = "promocode_updated",
  PROMOCODE_DELETED = "promocode_deleted",
  PROMOCODE_APPLIED = "promocode_applied",

  BOOKING_CREATED = "booking_created",
  BOOKING_UPDATED = "booking_updated",
  BOOKING_CONFIRMED = "booking_confirmed",
  BOOKING_CANCELLED = "booking_cancelled",
  BOOKING_COMPLETED = "booking_completed",
  BOOKING_NO_SHOW = "booking_no_show",
  BOOKING_DELETED = "booking_deleted",

  SPECIALIST_CREATED = "specialist_created",
  SPECIALIST_UPDATED = "specialist_updated",
  SPECIALIST_DELETED = "specialist_deleted",
  SPECIALIST_SCHEDULE_UPDATED = "specialist_schedule_updated",

  SERVICE_CREATED = "service_created",
  SERVICE_UPDATED = "service_updated",
  SERVICE_DELETED = "service_deleted",

  TIME_SLOT_CREATED = "time_slot_created",
  TIME_SLOT_UPDATED = "time_slot_updated",
  TIME_SLOT_DELETED = "time_slot_deleted",
  TIME_SLOT_GENERATED = "time_slot_generated",

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
@Index(["userId", "createdAt"])
@Index(["botId", "createdAt"])
@Index(["type", "createdAt"])
@Index(["level", "createdAt"])
@Index(["createdAt"])
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
    productId?: string;
    categoryId?: string;
    orderId?: string;
    promocodeId?: string;
    bookingId?: string;
    specialistId?: string;
    serviceId?: string;
    timeSlotId?: string;
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
