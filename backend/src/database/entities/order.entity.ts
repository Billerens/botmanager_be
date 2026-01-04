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
import { CartItem } from "./cart.entity";
import { PublicUser } from "./public-user.entity";
import { Shop } from "./shop.entity";
import { Payment, EntityPaymentStatus } from "./payment.entity";

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
@Index(["shopId", "telegramUsername"])
@Index(["shopId", "publicUserId"])
@Index(["shopId", "status"])
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Связь с магазином
  @Column()
  shopId: string;

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

  // ============================================
  // Платёжная информация
  // ============================================

  /**
   * ID связанного платежа
   */
  @Column({ nullable: true })
  paymentId: string | null;

  /**
   * Статус оплаты заказа
   */
  @Column({
    type: "enum",
    enum: EntityPaymentStatus,
    default: EntityPaymentStatus.NOT_REQUIRED,
  })
  paymentStatus: EntityPaymentStatus;

  /**
   * Требуется ли оплата для этого заказа
   */
  @Column({ default: false })
  paymentRequired: boolean;

  /**
   * Сумма к оплате (может отличаться от totalPrice при частичной оплате)
   */
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  paymentAmount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связь с магазином
  @ManyToOne(() => Shop, (shop) => shop.orders, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "shopId" })
  shop: Shop;

  @ManyToOne(() => PublicUser, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "publicUserId" })
  publicUser?: PublicUser;

  /**
   * Связь с платежом
   */
  @ManyToOne(() => Payment, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "paymentId" })
  payment?: Payment;

  // ============================================
  // Методы
  // ============================================
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

  // ============================================
  // Методы для работы с платежами
  // ============================================

  /**
   * Проверка, оплачен ли заказ
   */
  get isPaid(): boolean {
    return this.paymentStatus === EntityPaymentStatus.PAID;
  }

  /**
   * Проверка, ожидает ли заказ оплаты
   */
  get isAwaitingPayment(): boolean {
    return (
      this.paymentRequired &&
      this.paymentStatus === EntityPaymentStatus.PENDING
    );
  }

  /**
   * Проверка, была ли ошибка оплаты
   */
  get isPaymentFailed(): boolean {
    return this.paymentStatus === EntityPaymentStatus.FAILED;
  }

  /**
   * Проверка, был ли возврат
   */
  get isRefunded(): boolean {
    return (
      this.paymentStatus === EntityPaymentStatus.REFUNDED ||
      this.paymentStatus === EntityPaymentStatus.PARTIALLY_REFUNDED
    );
  }

  /**
   * Сумма к оплате (paymentAmount или totalPrice)
   */
  get amountToPay(): number {
    return this.paymentAmount ?? this.totalPrice;
  }
}
