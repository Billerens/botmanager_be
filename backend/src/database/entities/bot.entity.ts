import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Message } from "./message.entity";
import { Lead } from "./lead.entity";
import { BotFlow } from "./bot-flow.entity";
import { ActivityLog } from "./activity-log.entity";
import { BotCustomData } from "./bot-custom-data.entity";
import { Specialist } from "./specialist.entity";

export enum BotStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
}

export interface GlobalBreak {
  startTime: string; // "12:00" в UTC
  endTime: string; // "13:00" в UTC
  reason?: string; // "Обеденный перерыв"
}

export interface BookingSettings {
  // Основные настройки
  allowOnlineBooking: boolean;
  requireConfirmation: boolean;
  allowCancellation: boolean;
  cancellationTimeLimit: number; // в часах

  // Уведомления
  sendReminders: boolean;
  reminderTime: number; // в часах до записи
  sendConfirmations: boolean;

  // Ограничения
  maxAdvanceBooking: number; // дней вперед
  minAdvanceBooking: number; // часов вперед

  // Форма записи
  requiredFields: string[];
  optionalFields: string[];

  // Интеграции
  calendarIntegration: boolean;
  paymentIntegration: boolean;

  // Глобальные перерывы для всех специалистов
  globalBreaks?: GlobalBreak[];
}

@Entity("bots")
export class Bot {
  @PrimaryGeneratedColumn("uuid")
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
    type: "enum",
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
  @ManyToOne(() => User, (user) => user.bots, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
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

  @OneToMany(() => Specialist, (specialist) => specialist.bot)
  specialists: Specialist[];

  @OneToMany(() => BotCustomData, (customData) => customData.bot)
  customData: BotCustomData[];

  // Поля для системы бронирования
  @Column({ default: false })
  isBookingEnabled: boolean;

  @Column({ nullable: true })
  bookingTitle: string;

  @Column({ type: "text", nullable: true })
  bookingDescription: string;

  @Column({ nullable: true })
  bookingLogoUrl: string;

  @Column({ type: "text", nullable: true })
  bookingCustomStyles: string;

  @Column({ type: "json", nullable: true })
  bookingButtonTypes: string[];

  @Column({ type: "json", nullable: true })
  bookingButtonSettings: Record<string, any>;

  @Column({ type: "json", nullable: true })
  bookingSettings: BookingSettings;

  // Настройки браузерного доступа для бронирования
  @Column({ default: false })
  bookingBrowserAccessEnabled: boolean;

  // Методы
  get isActive(): boolean {
    return this.status === BotStatus.ACTIVE;
  }

  get hasError(): boolean {
    return this.status === BotStatus.ERROR;
  }

  get bookingUrl(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    return `${frontendUrl}/booking/${this.id}`;
  }

  get defaultBookingSettings(): BookingSettings {
    return {
      allowOnlineBooking: true,
      requireConfirmation: true,
      allowCancellation: true,
      cancellationTimeLimit: 2,
      sendReminders: true,
      reminderTime: 24,
      sendConfirmations: true,
      maxAdvanceBooking: 30,
      minAdvanceBooking: 2,
      requiredFields: ["clientName", "clientPhone"],
      optionalFields: ["clientEmail", "notes"],
      calendarIntegration: false,
      paymentIntegration: false,
    };
  }
}
