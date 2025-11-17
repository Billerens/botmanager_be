import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";

export enum CustomPageStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Entity("custom_pages")
export class CustomPage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string; // URL-friendly идентификатор

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text" })
  content: string; // HTML/Markdown контент

  @Column({
    type: "enum",
    enum: CustomPageStatus,
    default: CustomPageStatus.ACTIVE,
  })
  status: CustomPageStatus;

  @Column({ default: false })
  isWebAppOnly: boolean; // Только для WebApp или открывается в браузере

  @Column({ nullable: true })
  botCommand: string; // Команда в боте, например "contacts"

  // Связь с ботом
  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  botId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Геттер для URL
  get url(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    const botUsername = (this.bot as Bot)?.username || "unknown";
    return `${frontendUrl}/${botUsername}/${this.slug}`;
  }
}
