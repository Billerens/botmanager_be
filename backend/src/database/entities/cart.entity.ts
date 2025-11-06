import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Bot } from "./bot.entity";

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  currency: string;
  name: string;
  image?: string;
}

@Entity("carts")
@Index(["botId", "telegramUsername"], { unique: true })
export class Cart {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  botId: string;

  @Column()
  telegramUsername: string;

  @Column({ type: "json", default: "[]" })
  items: CartItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  // Методы
  get totalItems(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get totalPrice(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  get currency(): string {
    if (!this.items || this.items.length === 0) return "RUB";
    return this.items[0].currency;
  }
}

