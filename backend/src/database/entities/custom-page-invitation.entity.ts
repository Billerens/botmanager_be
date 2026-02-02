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
import { CustomPage } from "./custom-page.entity";
import { PermissionAction } from "./bot-user-permission.entity";
import { CustomPageEntity } from "./custom-page-user-permission.entity";

export enum CustomPageInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

@Entity("custom_page_invitations")
export class CustomPageInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CustomPage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "customPageId" })
  customPage: CustomPage;
  @Column()
  customPageId: string;

  @Column()
  invitedTelegramId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invitedUserId" })
  invitedUser?: User;
  @Column({ nullable: true })
  invitedUserId?: string;

  @Column({
    type: "enum",
    enum: CustomPageInvitationStatus,
    default: CustomPageInvitationStatus.PENDING,
  })
  status: CustomPageInvitationStatus;

  @Column({ type: "jsonb" })
  permissions: Record<CustomPageEntity, PermissionAction[]>;

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
