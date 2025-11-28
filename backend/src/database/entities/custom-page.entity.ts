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

export enum CustomPageType {
  INLINE = "inline", // HTML контент хранится в поле content
  STATIC = "static", // Статические файлы хранятся в S3
}

export interface CustomPageAsset {
  fileName: string; // Оригинальное имя файла (например, "index.html", "assets/main.js")
  s3Key: string; // Путь в S3 (например, "custom-pages/{pageId}/index.html")
  size: number; // Размер файла в байтах
  mimeType: string; // MIME тип файла
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

  @Column({
    type: "enum",
    enum: CustomPageType,
    default: CustomPageType.INLINE,
  })
  pageType: CustomPageType;

  @Column({ type: "text", nullable: true })
  content: string; // HTML/Markdown контент (для inline режима)

  @Column({ type: "text", nullable: true })
  staticPath: string; // Путь к папке в S3 (для static режима), например "custom-pages/{pageId}"

  @Column({ type: "varchar", default: "index.html" })
  entryPoint: string; // Точка входа для static режима

  @Column({ type: "simple-json", nullable: true })
  assets: CustomPageAsset[] | null; // Список файлов для static режима

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

  @Column({ default: true })
  showInMenu: boolean; // Отображать команду в меню бота (если false - команда работает, но не видна в меню)

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
    return `${frontendUrl}/pages/${botUsername}/${this.slug}`;
  }

  // Геттер для URL статических файлов
  get staticUrl(): string | null {
    if (this.pageType !== CustomPageType.STATIC || !this.staticPath) {
      return null;
    }
    const s3Endpoint = process.env.AWS_S3_ENDPOINT;
    const bucket = process.env.AWS_S3_BUCKET || "botmanager-products";
    return `${s3Endpoint}/${bucket}/${this.staticPath}`;
  }
}
