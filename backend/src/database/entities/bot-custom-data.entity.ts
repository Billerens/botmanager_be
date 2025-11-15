import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";

export enum CustomDataType {
  KEY_VALUE = "key_value",
  JSON_TABLE = "json_table",
}

@Entity("bot_custom_data")
@Index(["botId", "collection"])
@Index(["botId", "collection", "key"])
export class BotCustomData {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column()
  collection: string; // имя "таблицы" или коллекции

  @Column({ nullable: true })
  key: string; // ключ записи (для key-value)

  @Column({ type: "jsonb" })
  data: any; // произвольные данные

  @Column({ type: "jsonb", nullable: true })
  metadata: any; // индексы, теги, фильтры и т.д.

  @Column({
    type: "enum",
    enum: CustomDataType,
    default: CustomDataType.JSON_TABLE,
  })
  dataType: CustomDataType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Методы для удобства
  get isKeyValue(): boolean {
    return this.dataType === CustomDataType.KEY_VALUE;
  }

  get isJsonTable(): boolean {
    return this.dataType === CustomDataType.JSON_TABLE;
  }
}
