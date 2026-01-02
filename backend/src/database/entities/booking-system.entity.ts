import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Bot } from "./bot.entity";
import { Specialist } from "./specialist.entity";
import { SubdomainStatus } from "../../modules/custom-domains/enums/domain-status.enum";

export interface GlobalBreak {
  startTime: string; // "12:00" в UTC
  endTime: string; // "13:00" в UTC
  reason?: string; // "Обеденный перерыв"
}

export interface BookingSystemSettings {
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

/**
 * Сущность BookingSystem - независимая система бронирования
 *
 * Система бронирования может существовать независимо от бота и опционально
 * быть привязана к одному боту (связь 1:1).
 */
@Entity("booking_systems")
export class BookingSystem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string; // Название системы бронирования в панели управления

  // Уникальный slug для публичных субдоменов: {slug}.booking.botmanagertest.online
  @Column({ nullable: true, unique: true })
  slug?: string;

  // ============================================================================
  // СТАТУС СУБДОМЕНА ПЛАТФОРМЫ
  // ============================================================================

  /**
   * Статус субдомена платформы
   * null если slug не установлен
   */
  @Column({
    type: "enum",
    enum: SubdomainStatus,
    nullable: true,
  })
  subdomainStatus?: SubdomainStatus;

  /**
   * Сообщение об ошибке субдомена (если есть)
   */
  @Column({ nullable: true })
  subdomainError?: string;

  /**
   * Дата активации субдомена
   */
  @Column({ nullable: true })
  subdomainActivatedAt?: Date;

  /**
   * Полный URL субдомена (кэшированный для быстрого доступа)
   * Например: "mysalon.booking.botmanagertest.online"
   */
  @Column({ nullable: true })
  subdomainUrl?: string;

  // Владелец системы бронирования
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: User;

  @Column()
  ownerId: string;

  // Опциональная связь с ботом (1:1, nullable)
  // При удалении бота связь обнуляется, система бронирования остается
  @OneToOne(() => Bot, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "botId" })
  bot?: Bot;

  @Column({ nullable: true, unique: true })
  botId?: string;

  // Настройки внешнего вида
  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ nullable: true })
  title?: string; // Заголовок (отображается пользователям)

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  customStyles?: string; // Кастомные CSS стили

  // Типы кнопок (command, menu_button, etc.)
  @Column({ type: "json", nullable: true })
  buttonTypes?: string[];

  // Настройки для разных типов кнопок
  @Column({ type: "json", nullable: true })
  buttonSettings?: Record<string, any>;

  // Настройки системы бронирования
  @Column({ type: "json", nullable: true })
  settings?: BookingSystemSettings;

  // Настройки браузерного доступа
  @Column({ default: false })
  browserAccessEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи с зависимыми сущностями
  @OneToMany(() => Specialist, (specialist) => specialist.bookingSystem)
  specialists: Specialist[];

  // Вычисляемые свойства
  get url(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    return `${frontendUrl}/booking/${this.id}`;
  }

  /**
   * Публичный URL системы бронирования
   * Возвращает субдомен если активен, иначе стандартный URL
   */
  get publicUrl(): string {
    if (this.subdomainStatus === SubdomainStatus.ACTIVE && this.subdomainUrl) {
      return `https://${this.subdomainUrl}`;
    }
    return this.url;
  }

  get isActive(): boolean {
    // Система активна если у неё есть хотя бы название или title
    return !!(this.name || this.title);
  }

  get hasBot(): boolean {
    return !!this.botId;
  }

  get displayName(): string {
    return this.title || this.name;
  }

  /**
   * Проверяет, активен ли субдомен
   */
  get hasActiveSubdomain(): boolean {
    return (
      !!this.slug &&
      this.subdomainStatus === SubdomainStatus.ACTIVE &&
      !!this.subdomainUrl
    );
  }

  /**
   * Проверяет, находится ли субдомен в процессе активации
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
   * Настройки по умолчанию для системы бронирования
   */
  get defaultSettings(): BookingSystemSettings {
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
