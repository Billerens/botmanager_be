import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isWorking: boolean;
  startTime: string; // "09:00" в UTC
  endTime: string; // "18:00" в UTC
  breaks?: BreakTime[];
}

export interface BreakTime {
  startTime: string; // "12:00" в UTC
  endTime: string; // "13:00" в UTC
  reason?: string;
}

@Entity("specialists")
export class Specialist {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "json", nullable: true })
  workingHours: WorkingHours; // Расписание работы в UTC

  @Column({ type: "json", nullable: true })
  breakTimes: BreakTime[]; // Перерывы в UTC

  @Column({ default: 30 })
  defaultSlotDuration: number; // Длительность слота в минутах

  @Column({ default: 0 })
  bufferTime: number; // Буферное время между записями в минутах

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, (bot) => bot.specialists, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  botId: string;

  @OneToMany("Service", "specialist")
  services: any[];

  @OneToMany("Booking", "specialist")
  bookings: any[];

  @OneToMany("TimeSlot", "specialist")
  timeSlots: any[];

  // Методы для работы с временем
  isWorkingAt(date: Date): boolean {
    if (!this.workingHours) return false;

    const dayOfWeek = this.getDayOfWeek(date);
    const daySchedule = this.workingHours[dayOfWeek];

    if (!daySchedule || !daySchedule.isWorking) return false;

    const timeStr = this.formatTimeUTC(date);
    return timeStr >= daySchedule.startTime && timeStr <= daySchedule.endTime;
  }

  isOnBreak(date: Date): boolean {
    if (!this.breakTimes || this.breakTimes.length === 0) return false;

    const timeStr = this.formatTimeUTC(date);

    return this.breakTimes.some(
      (breakTime) =>
        timeStr >= breakTime.startTime && timeStr <= breakTime.endTime
    );
  }

  private getDayOfWeek(date: Date): keyof WorkingHours {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[date.getUTCDay()] as keyof WorkingHours;
  }

  private formatTimeUTC(date: Date): string {
    return date.toISOString().substring(11, 16); // HH:MM в UTC
  }

  getWorkingHoursForDay(dayOfWeek: keyof WorkingHours): DaySchedule | null {
    return this.workingHours?.[dayOfWeek] || null;
  }
}
