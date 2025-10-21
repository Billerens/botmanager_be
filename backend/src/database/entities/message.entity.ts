import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";

export enum MessageType {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
}

export enum MessageContentType {
  TEXT = "text",
  PHOTO = "photo",
  VIDEO = "video",
  AUDIO = "audio",
  DOCUMENT = "document",
  STICKER = "sticker",
  VOICE = "voice",
  LOCATION = "location",
  CONTACT = "contact",
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "bigint" })
  telegramMessageId: number;

  @Column()
  telegramChatId: string;

  @Column({ nullable: true })
  telegramUserId: string;

  @Column({
    type: "enum",
    enum: MessageType,
  })
  type: MessageType;

  @Column({
    type: "enum",
    enum: MessageContentType,
    default: MessageContentType.TEXT,
  })
  contentType: MessageContentType;

  @Column({ type: "text", nullable: true })
  text: string;

  @Column({ type: "json", nullable: true })
  media: {
    fileId: string;
    fileUniqueId: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
  };

  @Column({ type: "json", nullable: true })
  keyboard: {
    type: "reply" | "inline";
    buttons: Array<{
      text: string;
      callbackData?: string;
      url?: string;
      webApp?: string;
    }>;
  };

  @Column({ type: "json", nullable: true })
  metadata: {
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isBot?: boolean;
    replyToMessageId?: number;
    forwardFrom?: any;
    chatType?: string;
    chatTitle?: string;
    chatUsername?: string;
  };

  @Column({ default: false })
  isProcessed: boolean;

  @Column({ nullable: true })
  processedAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  // Связи
  @ManyToOne(() => Bot, (bot) => bot.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  botId: string;

  // Методы
  get isIncoming(): boolean {
    return this.type === MessageType.INCOMING;
  }

  get isOutgoing(): boolean {
    return this.type === MessageType.OUTGOING;
  }

  get hasMedia(): boolean {
    return this.contentType !== MessageContentType.TEXT;
  }

  get hasKeyboard(): boolean {
    return this.keyboard && this.keyboard.buttons.length > 0;
  }
}
