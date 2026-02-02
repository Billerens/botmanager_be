import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { BookingSystem } from "./booking-system.entity";
import { PermissionAction } from "./bot-user-permission.entity";
import { BookingEntity } from "./booking-system-user-permission.entity";

@Entity("booking_system_users")
export class BookingSystemUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => BookingSystem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bookingSystemId" })
  bookingSystem: BookingSystem;
  @Column()
  bookingSystemId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
  @Column()
  userId: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ type: "jsonb", nullable: true })
  permissions: Record<BookingEntity, PermissionAction[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
