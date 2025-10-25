import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Specialist } from "./specialist.entity";
import { Service } from "./service.entity";
import { TimeSlot } from "./time-slot.entity";

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

@Entity("bookings")
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

  @Column({ type: "text", nullable: true })
  notes: string;

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

  @Column({ type: "timestamp", nullable: true })
  confirmedAt: Date; // Время подтверждения в UTC

  @Column({ type: "timestamp", nullable: true })
  cancelledAt: Date; // Время отмены в UTC

  @Column({ type: "text", nullable: true })
  cancellationReason: string;

  @Column({ type: "json", nullable: true })
  clientData: Record<string, any>;

  @Column({ type: "text", nullable: true })
  confirmationCode: string; // Код для подтверждения записи

  @Column({ type: "timestamp", nullable: true })
  confirmationCodeExpires: Date; // Срок действия кода подтверждения

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

  @OneToOne("TimeSlot", "booking")
  timeSlot: any;

  @Column()
  timeSlotId: string;

  // Методы
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
}
