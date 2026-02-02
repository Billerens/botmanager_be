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

export enum BookingSystemInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

@Entity("booking_system_invitations")
export class BookingSystemInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => BookingSystem, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bookingSystemId" })
  bookingSystem: BookingSystem;
  @Column()
  bookingSystemId: string;

  @Column()
  invitedTelegramId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invitedUserId" })
  invitedUser?: User;
  @Column({ nullable: true })
  invitedUserId?: string;

  @Column({
    type: "enum",
    enum: BookingSystemInvitationStatus,
    default: BookingSystemInvitationStatus.PENDING,
  })
  status: BookingSystemInvitationStatus;

  @Column({ type: "jsonb" })
  permissions: Record<BookingEntity, PermissionAction[]>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invitedByUserId" })
  invitedByUser: User;
  @Column()
  invitedByUserId: string;

  @Column({ nullable: true })
  invitationToken: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
