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

@Entity("time_slots")
export class TimeSlot {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "timestamp" })
  startTime: Date; // Время начала в UTC

  @Column({ type: "timestamp" })
  endTime: Date; // Время окончания в UTC

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: false })
  isBooked: boolean;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Specialist, (specialist) => specialist.timeSlots, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "specialistId" })
  specialist: Specialist;

  @Column()
  specialistId: string;

  @OneToOne("Booking", "timeSlot")
  booking: any;

  // Методы для работы с временем
  getDuration(): number {
    return Math.floor(
      (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60)
    );
  }

  isInPast(): boolean {
    return this.startTime < new Date();
  }

  isToday(): boolean {
    const now = new Date();
    const slotDate = new Date(this.startTime);

    return (
      slotDate.getUTCFullYear() === now.getUTCFullYear() &&
      slotDate.getUTCMonth() === now.getUTCMonth() &&
      slotDate.getUTCDate() === now.getUTCDate()
    );
  }

  isTomorrow(): boolean {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const slotDate = new Date(this.startTime);

    return (
      slotDate.getUTCFullYear() === tomorrow.getUTCFullYear() &&
      slotDate.getUTCMonth() === tomorrow.getUTCMonth() &&
      slotDate.getUTCDate() === tomorrow.getUTCDate()
    );
  }

  getFormattedTime(): string {
    return this.startTime.toISOString().substring(11, 16); // HH:MM в UTC
  }

  getFormattedDate(): string {
    return this.startTime.toISOString().substring(0, 10); // YYYY-MM-DD
  }

  getFormattedDateTime(): string {
    return this.startTime.toISOString().substring(0, 16).replace("T", " "); // YYYY-MM-DD HH:MM
  }

  // Проверка конфликтов с другим слотом
  hasConflict(otherSlot: TimeSlot): boolean {
    return (
      this.startTime < otherSlot.endTime && this.endTime > otherSlot.startTime
    );
  }

  // Проверка, можно ли забронировать слот
  canBeBooked(): boolean {
    return this.isAvailable && !this.isBooked && !this.isInPast();
  }
}
