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

export enum BookingEntity {
  BOOKING_SETTINGS = "booking_settings",
  SPECIALISTS = "specialists",
  SERVICES = "services",
  BOOKINGS = "bookings",
  BOOKING_SYSTEM_USERS = "booking_system_users",
}

@Entity("booking_system_user_permissions")
export class BookingSystemUserPermission {
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

  @Column({
    type: "enum",
    enum: BookingEntity,
  })
  entity: BookingEntity;

  @Column({
    type: "enum",
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ default: false })
  granted: boolean;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "grantedByUserId" })
  grantedByUser?: User;
  @Column({ nullable: true })
  grantedByUserId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
