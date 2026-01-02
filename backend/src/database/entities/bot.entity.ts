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
import { SubdomainStatus } from "../../modules/custom-domains/enums/domain-status.enum";

export enum BotStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
}

/**
 * @deprecated Используйте GlobalBreak из booking-system.entity.ts
 */
export interface GlobalBreak {
  startTime: string; // "12:00" в UTC
  endTime: string; // "13:00" в UTC
  reason?: string; // "Обеденный перерыв"
}

/**
 * @deprecated Используйте BookingSystemSettings из booking-system.entity.ts
 */
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

  // ============================================================================
  // ПОЛЯ СУБДОМЕНА БРОНИРОВАНИЯ (deprecated - перенесены в BookingSystem)
  // ============================================================================

  /**
   * @deprecated Используйте BookingSystem.slug. Поле будет удалено в будущих версиях.
   * Уникальный slug для публичных субдоменов: {slug}.booking.botmanagertest.online
   */
  @Column({ nullable: true, unique: true })
  slug?: string;

  /**
   * @deprecated Используйте BookingSystem.subdomainStatus. Поле будет удалено в будущих версиях.
   * Статус активации субдомена
   */
  @Column({
    type: "enum",
    enum: SubdomainStatus,
    nullable: true,
  })
  subdomainStatus?: SubdomainStatus;

  /**
   * @deprecated Используйте BookingSystem.subdomainError. Поле будет удалено в будущих версиях.
   * Сообщение об ошибке субдомена (если есть)
   */
  @Column({ nullable: true })
  subdomainError?: string;

  /**
   * @deprecated Используйте BookingSystem.subdomainActivatedAt. Поле будет удалено в будущих версиях.
   * Дата активации субдомена
   */
  @Column({ nullable: true })
  subdomainActivatedAt?: Date;

  /**
   * @deprecated Используйте BookingSystem.subdomainUrl. Поле будет удалено в будущих версиях.
   * Полный URL субдомена (кэшированный для быстрого доступа)
   * Например: "mysalon.booking.botmanagertest.online"
   */
  @Column({ nullable: true })
  subdomainUrl?: string;

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

  // ============================================================================
  // ПОЛЯ СИСТЕМЫ БРОНИРОВАНИЯ (deprecated - перенесены в BookingSystem)
  // ============================================================================

  /**
   * @deprecated Используйте связь с BookingSystem. Поле будет удалено в будущих версиях.
   */
  @Column({ default: false })
  isBookingEnabled: boolean;

  /**
   * @deprecated Используйте BookingSystem.title. Поле будет удалено в будущих версиях.
   */
  @Column({ nullable: true })
  bookingTitle: string;

  /**
   * @deprecated Используйте BookingSystem.description. Поле будет удалено в будущих версиях.
   */
  @Column({ type: "text", nullable: true })
  bookingDescription: string;

  /**
   * @deprecated Используйте BookingSystem.logoUrl. Поле будет удалено в будущих версиях.
   */
  @Column({ nullable: true })
  bookingLogoUrl: string;

  /**
   * @deprecated Используйте BookingSystem.customStyles. Поле будет удалено в будущих версиях.
   */
  @Column({ type: "text", nullable: true })
  bookingCustomStyles: string;

  /**
   * @deprecated Используйте BookingSystem.buttonTypes. Поле будет удалено в будущих версиях.
   */
  @Column({ type: "json", nullable: true })
  bookingButtonTypes: string[];

  /**
   * @deprecated Используйте BookingSystem.buttonSettings. Поле будет удалено в будущих версиях.
   */
  @Column({ type: "json", nullable: true })
  bookingButtonSettings: Record<string, any>;

  /**
   * @deprecated Используйте BookingSystem.settings. Поле будет удалено в будущих версиях.
   */
  @Column({ type: "json", nullable: true })
  bookingSettings: BookingSettings;

  /**
   * @deprecated Используйте BookingSystem.browserAccessEnabled. Поле будет удалено в будущих версиях.
   */
  @Column({ default: false })
  bookingBrowserAccessEnabled: boolean;

  // Методы
  get isActive(): boolean {
    return this.status === BotStatus.ACTIVE;
  }

  get hasError(): boolean {
    return this.status === BotStatus.ERROR;
  }

  // ============================================================================
  // ГЕТТЕРЫ БРОНИРОВАНИЯ (deprecated - используйте BookingSystem)
  // ============================================================================

  /**
   * @deprecated Используйте BookingSystem.url. Будет удален в будущих версиях.
   */
  get bookingUrl(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    return `${frontendUrl}/booking/${this.id}`;
  }

  /**
   * @deprecated Используйте BookingSystem.publicUrl. Будет удален в будущих версиях.
   * Публичный URL бронирования
   * Возвращает субдомен если активен, иначе стандартный URL
   */
  get publicBookingUrl(): string {
    if (this.subdomainStatus === SubdomainStatus.ACTIVE && this.subdomainUrl) {
      return `https://${this.subdomainUrl}`;
    }
    return this.bookingUrl;
  }

  /**
   * @deprecated Используйте BookingSystem.hasActiveSubdomain. Будет удален в будущих версиях.
   * Проверка, активен ли субдомен
   */
  get hasActiveSubdomain(): boolean {
    return (
      !!this.slug &&
      this.subdomainStatus === SubdomainStatus.ACTIVE &&
      !!this.subdomainUrl
    );
  }

  /**
   * @deprecated Используйте BookingSystem.isSubdomainPending. Будет удален в будущих версиях.
   * Проверка, в процессе ли активация субдомена
   */
  get isSubdomainPending(): boolean {
    return (
      !!this.slug &&
      (this.subdomainStatus === SubdomainStatus.PENDING ||
        this.subdomainStatus === SubdomainStatus.DNS_CREATING ||
        this.subdomainStatus === SubdomainStatus.ACTIVATING)
    );
  }

  /**
   * @deprecated Используйте BookingSystem.defaultSettings. Будет удален в будущих версиях.
   */
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
