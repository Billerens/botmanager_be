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
import { Shop } from "./shop.entity";

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

/**
 * Кастомная страница - независимая сущность, принадлежащая пользователю.
 *
 * Может быть опционально привязана к:
 * - Bot (N:1) - для отображения команд в меню бота
 * - Shop (N:1) - для ассоциации с магазином
 *
 * Логика привязки:
 * - При привязке к боту, у которого есть магазин → страница привязывается и к магазину
 * - При привязке к магазину, у которого есть бот → страница привязывается и к боту
 */
@Entity("custom_pages")
export class CustomPage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, unique: true })
  slug: string | null; // URL-friendly идентификатор (опционально, глобально уникален)

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

  // ============================================================
  // Связь с владельцем (обязательная)
  // ============================================================
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: User;

  @Column()
  ownerId: string;

  // ============================================================
  // Связь с ботом (опциональная)
  // ============================================================
  @ManyToOne(() => Bot, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "botId" })
  bot?: Bot;

  @Column({ nullable: true })
  botId?: string;

  // ============================================================
  // Связь с магазином (опциональная)
  // ============================================================
  @ManyToOne(() => Shop, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "shopId" })
  shop?: Shop;

  @Column({ nullable: true })
  shopId?: string;

  // ============================================================
  // Временные метки
  // ============================================================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ============================================================
  // Геттеры
  // ============================================================

  /**
   * URL страницы - по slug (если есть) или по ID
   */
  get url(): string {
    const frontendUrl =
      process.env.FRONTEND_URL || "https://botmanagertest.online";
    const identifier = this.slug || this.id;
    return `${frontendUrl}/pages/${identifier}`;
  }

  /**
   * URL статических файлов (для static режима)
   */
  get staticUrl(): string | null {
    if (this.pageType !== CustomPageType.STATIC || !this.staticPath) {
      return null;
    }
    const s3Endpoint = process.env.AWS_S3_ENDPOINT;
    const bucket = process.env.AWS_S3_BUCKET || "botmanager-products";
    return `${s3Endpoint}/${bucket}/${this.staticPath}`;
  }

  /**
   * Проверка, привязана ли страница к боту
   */
  get hasBot(): boolean {
    return !!this.botId;
  }

  /**
   * Проверка, привязана ли страница к магазину
   */
  get hasShop(): boolean {
    return !!this.shopId;
  }
}
