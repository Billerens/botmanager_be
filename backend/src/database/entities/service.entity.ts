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
import { Specialist } from "./specialist.entity";
import { Booking } from "./booking.entity";

@Entity("services")
export class Service {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ default: 30 })
  duration: number; // Длительность в минутах

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  category: string;

  @Column({ type: "json", nullable: true })
  requirements: string[]; // Требования к клиенту

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Specialist, (specialist) => specialist.services, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "specialistId" })
  specialist: Specialist;

  @Column()
  specialistId: string;

  @OneToMany(() => Booking, (booking) => booking.service)
  bookings: Booking[];

  // Методы
  getFormattedPrice(): string {
    if (!this.price) return "Бесплатно";
    return `${this.price} ₽`;
  }

  getFormattedDuration(): string {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}ч ${minutes}м`;
    } else if (hours > 0) {
      return `${hours}ч`;
    } else {
      return `${minutes}м`;
    }
  }

  hasRequirements(): boolean {
    return this.requirements && this.requirements.length > 0;
  }
}
