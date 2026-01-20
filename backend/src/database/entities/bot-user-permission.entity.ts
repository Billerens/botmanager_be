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

export enum BotEntity {
  BOT_SETTINGS = "bot_settings",
  FLOWS = "flows",
  MESSAGES = "messages",
  LEADS = "leads",
  PRODUCTS = "products",
  CATEGORIES = "categories",
  ORDERS = "orders",
  CARTS = "carts",
  SPECIALISTS = "specialists",
  BOOKINGS = "bookings",
  ANALYTICS = "analytics",
  SHOP_SETTINGS = "shop_settings",
  BOOKING_SETTINGS = "booking_settings",
  CUSTOM_PAGES = "custom_pages",
  SHOP_PROMOCODES = "shop_promocodes",
  BOT_USERS = "bot_users",
  CUSTOM_DATA = "custom_data", // Права на кастомные данные (новая система)
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
