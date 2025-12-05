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
import { CartItem } from "./cart.entity";
import { PublicUser } from "./public-user.entity";

export enum OrderStatus {
  PENDING = "pending", // Ожидает обработки
  CONFIRMED = "confirmed", // Подтвержден
  PROCESSING = "processing", // В обработке
  SHIPPED = "shipped", // Отправлен
  DELIVERED = "delivered", // Доставлен
  CANCELLED = "cancelled", // Отменен
}

export interface OrderCustomerData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  [key: string]: any; // Для дополнительных полей
}

@Entity("orders")
@Index(["botId", "telegramUsername"])
@Index(["botId", "publicUserId"])
@Index(["botId", "status"])
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  botId: string;

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({ nullable: true })
  publicUserId: string; // ID пользователя для браузерного доступа

  @Column({ type: "json" })
  items: CartItem[]; // Структура как в корзине

  @Column({ type: "json", nullable: true })
  customerData: OrderCustomerData; // Данные покупателя

  @Column({ type: "text", nullable: true })
  additionalMessage?: string; // Дополнительное сообщение (необязательное)

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ length: 3, default: "RUB" })
  currency: string;

  @Column({ nullable: true })
  appliedPromocodeId: string | null; // ID примененного промокода

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  promocodeDiscount: number | null; // Размер скидки от промокода

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @ManyToOne(() => PublicUser, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "publicUserId" })
  publicUser?: PublicUser;

  // Методы
  get totalItems(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get isPending(): boolean {
    return this.status === OrderStatus.PENDING;
  }

  get isConfirmed(): boolean {
    return this.status === OrderStatus.CONFIRMED;
  }

  get isProcessing(): boolean {
    return this.status === OrderStatus.PROCESSING;
  }

  get isShipped(): boolean {
    return this.status === OrderStatus.SHIPPED;
  }

  get isDelivered(): boolean {
    return this.status === OrderStatus.DELIVERED;
  }

  get isCancelled(): boolean {
    return this.status === OrderStatus.CANCELLED;
  }
}
