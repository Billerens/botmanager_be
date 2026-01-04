import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Specialist } from "./specialist.entity";
import { Service } from "./service.entity";
import { TimeSlot } from "./time-slot.entity";
import { PublicUser } from "./public-user.entity";
import { Payment, EntityPaymentStatus } from "./payment.entity";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  NO_SHOW = "no_show",
}

export enum BookingSource {
  TELEGRAM_BOT = "telegram_bot",
  MINI_APP = "mini_app",
  WEBSITE = "website",
  PHONE = "phone",
  OTHER = "other",
}

export interface BookingReminder {
  timeValue: number; // Числовое значение (например, 1, 2, 24)
  timeUnit: "minutes" | "hours" | "days"; // Единица измерения
  sent: boolean; // Было ли отправлено уведомление
  sentAt?: Date; // Время отправки уведомления
  scheduledFor?: Date; // Запланированное время отправки
}

@Entity("bookings")
@Index(["publicUserId"])
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  clientName: string;

  @Column({ nullable: true })
  clientPhone: string;

  @Column({ nullable: true })
  clientEmail: string;

  @Column({ nullable: true })
  telegramUserId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({ nullable: true })
  publicUserId: string; // ID пользователя для браузерного доступа

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "json", nullable: true })
  reminders: BookingReminder[];

  @Column({
    type: "enum",
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({
    type: "enum",
    enum: BookingSource,
    default: BookingSource.MINI_APP,
  })
  source: BookingSource;

  @Column({ type: "timestamptz", nullable: true })
  confirmedAt: Date; // Время подтверждения в UTC

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt: Date; // Время отмены в UTC

  @Column({ type: "text", nullable: true })
  cancellationReason: string;

  @Column({ type: "json", nullable: true })
  clientData: Record<string, any>;

  @Column({ type: "text", nullable: true })
  confirmationCode: string; // Код для подтверждения записи

  @Column({ type: "timestamptz", nullable: true })
  confirmationCodeExpires: Date; // Срок действия кода подтверждения

  // ============================================
  // Платёжная информация
  // ============================================

  /**
   * ID связанного платежа
   */
  @Column({ nullable: true })
  paymentId: string | null;

  /**
   * Статус оплаты бронирования
   */
  @Column({
    type: "enum",
    enum: EntityPaymentStatus,
    default: EntityPaymentStatus.NOT_REQUIRED,
  })
  paymentStatus: EntityPaymentStatus;

  /**
   * Требуется ли оплата для этого бронирования
   */
  @Column({ default: false })
  paymentRequired: boolean;

  /**
   * Сумма к оплате
   */
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  paymentAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Specialist, (specialist) => specialist.bookings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "specialistId" })
  specialist: Specialist;

  @Column()
  specialistId: string;

  @ManyToOne(() => Service, (service) => service.bookings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "serviceId" })
  service: Service;

  @Column()
  serviceId: string;

  @ManyToOne(() => TimeSlot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "timeSlotId" })
  timeSlot: TimeSlot;

  @Column()
  timeSlotId: string;

  @ManyToOne(() => PublicUser, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "publicUserId" })
  publicUser?: PublicUser;

  /**
   * Связь с платежом
   */
  @ManyToOne(() => Payment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "paymentId" })
  payment?: Payment;

  // ============================================
  // Методы
  // ============================================

  get isPending(): boolean {
    return this.status === BookingStatus.PENDING;
  }

  get isConfirmed(): boolean {
    return this.status === BookingStatus.CONFIRMED;
  }

  get isCancelled(): boolean {
    return this.status === BookingStatus.CANCELLED;
  }

  get isCompleted(): boolean {
    return this.status === BookingStatus.COMPLETED;
  }

  get isNoShow(): boolean {
    return this.status === BookingStatus.NO_SHOW;
  }

  get canBeCancelled(): boolean {
    if (this.isCancelled || this.isCompleted) return false;

    // Можно отменить за 2 часа до начала
    const twoHoursBefore = new Date(
      this.timeSlot.startTime.getTime() - 2 * 60 * 60 * 1000
    );
    return new Date() < twoHoursBefore;
  }

  get canBeConfirmed(): boolean {
    return (
      this.isPending &&
      this.confirmationCode &&
      this.confirmationCodeExpires > new Date()
    );
  }

  get isExpired(): boolean {
    return (
      this.confirmationCodeExpires && this.confirmationCodeExpires < new Date()
    );
  }

  getFormattedDateTime(): string {
    return this.timeSlot.getFormattedDateTime();
  }

  getFormattedDate(): string {
    return this.timeSlot.getFormattedDate();
  }

  getFormattedTime(): string {
    return this.timeSlot.getFormattedTime();
  }

  getDuration(): number {
    return this.timeSlot.getDuration();
  }

  // Генерация кода подтверждения
  generateConfirmationCode(): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.confirmationCode = code;
    this.confirmationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    return code;
  }

  // Подтверждение записи
  confirm(): void {
    if (!this.canBeConfirmed) {
      throw new Error("Запись не может быть подтверждена");
    }

    this.status = BookingStatus.CONFIRMED;
    this.confirmedAt = new Date();
    this.confirmationCode = null;
    this.confirmationCodeExpires = null;
  }

  // Отмена записи
  cancel(reason?: string): void {
    if (!this.canBeCancelled) {
      throw new Error("Запись не может быть отменена");
    }

    this.status = BookingStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    this.confirmationCode = null;
    this.confirmationCodeExpires = null;
  }

  // Отметка как неявка
  markAsNoShow(): void {
    if (this.isCompleted) {
      throw new Error("Завершенная запись не может быть отмечена как неявка");
    }

    this.status = BookingStatus.NO_SHOW;
  }

  // Отметка как завершенная
  markAsCompleted(): void {
    if (this.isCancelled || this.isNoShow) {
      throw new Error("Отмененная или неявка запись не может быть завершена");
    }

    this.status = BookingStatus.COMPLETED;
  }

  // ============================================
  // Методы для работы с платежами
  // ============================================

  /**
   * Проверка, оплачено ли бронирование
   */
  get isPaid(): boolean {
    return this.paymentStatus === EntityPaymentStatus.PAID;
  }

  /**
   * Проверка, ожидает ли бронирование оплаты
   */
  get isAwaitingPayment(): boolean {
    return (
      this.paymentRequired &&
      this.paymentStatus === EntityPaymentStatus.PENDING
    );
  }

  /**
   * Проверка, была ли ошибка оплаты
   */
  get isPaymentFailed(): boolean {
    return this.paymentStatus === EntityPaymentStatus.FAILED;
  }

  /**
   * Проверка, был ли возврат
   */
  get isRefunded(): boolean {
    return (
      this.paymentStatus === EntityPaymentStatus.REFUNDED ||
      this.paymentStatus === EntityPaymentStatus.PARTIALLY_REFUNDED
    );
  }

  /**
   * Сумма к оплате (paymentAmount или стоимость услуги)
   */
  get amountToPay(): number | null {
    return this.paymentAmount;
  }
}
