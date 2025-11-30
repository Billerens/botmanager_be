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

@Entity("bot_users")
export class BotUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;
  @Column()
  botId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
  @Column()
  userId: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ type: "jsonb", nullable: true })
  permissions: Record<BotEntity, PermissionAction[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
