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
import { Bot } from "./bot.entity";
import { PermissionAction, BotEntity } from "./bot-user-permission.entity";

export enum BotInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

@Entity("bot_invitations")
export class BotInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;
  @Column()
  botId: string;

  @Column()
  invitedTelegramId: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invitedUserId" })
  invitedUser?: User;
  @Column({ nullable: true })
  invitedUserId?: string;

  @Column({
    type: "enum",
    enum: BotInvitationStatus,
    default: BotInvitationStatus.PENDING,
  })
  status: BotInvitationStatus;

  @Column({ type: "jsonb" })
  permissions: Record<BotEntity, PermissionAction[]>;

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
