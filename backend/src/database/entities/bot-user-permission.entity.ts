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

export enum PermissionAction {
  READ = "read",
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

/**
 * Сущности бота, на которые выдаются права приглашённым.
 * Права магазина, букинга и custom page выносятся в отдельные модели (ShopEntity, BookingEntity, CustomPageEntity).
 */
export enum BotEntity {
  BOT_SETTINGS = "bot_settings",
  FLOWS = "flows",
  MESSAGES = "messages",
  LEADS = "leads",
  ANALYTICS = "analytics",
  BOT_USERS = "bot_users",
  CUSTOM_DATA = "custom_data",
}

@Entity("bot_user_permissions")
export class BotUserPermission {
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

  @Column({
    type: "enum",
    enum: BotEntity,
  })
  entity: BotEntity;

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
