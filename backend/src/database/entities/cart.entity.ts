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
import { Expose } from "class-transformer";
import { Bot } from "./bot.entity";
import { PublicUser } from "./public-user.entity";

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  currency: string;
  name: string;
  image?: string;
}

@Entity("carts")
@Index(["botId", "telegramUsername"])
@Index(["botId", "publicUserId"])
export class Cart {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  botId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({ nullable: true })
  publicUserId: string; // ID пользователя для браузерного доступа

  @Column({ type: "json", default: "[]" })
  items: CartItem[];

  @Column({ nullable: true })
  appliedPromocodeId: string | null; // ID примененного промокода

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @ManyToOne(() => PublicUser, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "publicUserId" })
  publicUser?: PublicUser;

  // Методы
  @Expose()
  get totalItems(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  @Expose()
  get totalPrice(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
  }

  @Expose()
  get currency(): string {
    if (!this.items || this.items.length === 0) return "RUB";
    return this.items[0].currency;
  }
}

