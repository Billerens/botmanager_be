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
import { User } from "./user.entity";
import { PaymentEntityType } from "./payment-config.entity";

/**
 * Тип цели платежа (что оплачивается)
 */
export enum PaymentTargetType {
  ORDER = "order",
  BOOKING = "booking",
  API_CALL = "api_call",
  FLOW_PAYMENT = "flow_payment",
  CUSTOM = "custom",
}

/**
 * Статус платежа
 */
export enum PaymentStatus {
  PENDING = "pending",
  WAITING_FOR_CAPTURE = "waiting_for_capture",
  SUCCEEDED = "succeeded",
  CANCELED = "canceled",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
  FAILED = "failed",
}

/**
 * Статус оплаты для связанных сущностей (Order, Booking)
 */
export enum EntityPaymentStatus {
  NOT_REQUIRED = "not_required",
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
}

/**
 * Данные покупателя
 */
export interface PaymentCustomerData {
  email?: string;
  phone?: string;
  fullName?: string;
  telegramUserId?: string;
  telegramUsername?: string;
}

/**
 * Запись в истории статусов
 */
export interface PaymentStatusHistoryEntry {
  status: PaymentStatus;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Информация о возврате
 */
export interface PaymentRefundInfo {
  refundId: string;
  externalRefundId: string;
  amount: number;
  reason?: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Сущность Payment - запись о платеже
 *
 * Хранит информацию о всех платежах в системе.
 * Связывается с источником (Shop, BookingSystem, etc.) и целью (Order, Booking, etc.)
 */
@Entity("payments")
@Index(["entityType", "entityId"])
@Index(["targetType", "targetId"])
@Index(["externalId"], { unique: true })
@Index(["status"])
@Index(["createdAt"])
@Index(["ownerId"])
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // ============================================
  // Связь с источником (откуда платёж)
  // ============================================

  /**
   * Тип источника (shop, booking_system, custom_page, bot)
   */
  @Column({
    type: "enum",
    enum: PaymentEntityType,
  })
  entityType: PaymentEntityType;

  /**
   * ID источника
   */
  @Column("uuid")
  entityId: string;

  // ============================================
  // Связь с целью (что оплачивается)
  // ============================================

  /**
   * Тип цели (order, booking, api_call, flow_payment, custom)
   */
  @Column({
    type: "enum",
    enum: PaymentTargetType,
    nullable: true,
  })
  targetType?: PaymentTargetType;

  /**
   * ID цели (заказа, бронирования, etc.)
   */
  @Column("uuid", { nullable: true })
  targetId?: string;

  // ============================================
  // Владелец
  // ============================================

  /**
   * ID владельца сущности
   */
  @Column("uuid")
  ownerId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: User;

  // ============================================
  // Платёжная информация
  // ============================================

  /**
   * Платёжный провайдер (yookassa, stripe, etc.)
   */
  @Column()
  provider: string;

  /**
   * Внешний ID платежа у провайдера
   */
  @Column({ unique: true })
  externalId: string;

  /**
   * Статус платежа
   */
  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  /**
   * Сумма платежа
   */
  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount: number;

  /**
   * Валюта (ISO 4217)
   */
  @Column({ length: 3 })
  currency: string;

  /**
   * URL для оплаты (redirect)
   */
  @Column({ type: "text", nullable: true })
  paymentUrl?: string;

  /**
   * Описание платежа
   */
  @Column({ type: "text", nullable: true })
  description?: string;

  /**
   * Данные покупателя
   */
  @Column({ type: "jsonb", nullable: true })
  customerData?: PaymentCustomerData;

  /**
   * Дополнительные метаданные
   */
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  // ============================================
  // История и события
  // ============================================

  /**
   * История изменений статуса
   */
  @Column({ type: "jsonb", default: [] })
  statusHistory: PaymentStatusHistoryEntry[];

  /**
   * Информация о возвратах
   */
  @Column({ type: "jsonb", default: [] })
  refunds: PaymentRefundInfo[];

  /**
   * Общая сумма возвратов
   */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  refundedAmount: number;

  // ============================================
  // Временные метки
  // ============================================

  /**
   * Дата успешной оплаты
   */
  @Column({ type: "timestamptz", nullable: true })
  paidAt?: Date;

  /**
   * Дата отмены
   */
  @Column({ type: "timestamptz", nullable: true })
  canceledAt?: Date;

  /**
   * Дата истечения (для pending платежей)
   */
  @Column({ type: "timestamptz", nullable: true })
  expiresAt?: Date;

  /**
   * Сообщение об ошибке (если failed)
   */
  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  /**
   * Код ошибки
   */
  @Column({ nullable: true })
  errorCode?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ============================================
  // Методы
  // ============================================

  /**
   * Проверка, успешен ли платёж
   */
  get isSucceeded(): boolean {
    return this.status === PaymentStatus.SUCCEEDED;
  }

  /**
   * Проверка, в ожидании ли платёж
   */
  get isPending(): boolean {
    return (
      this.status === PaymentStatus.PENDING ||
      this.status === PaymentStatus.WAITING_FOR_CAPTURE
    );
  }

  /**
   * Проверка, отменён ли платёж
   */
  get isCanceled(): boolean {
    return this.status === PaymentStatus.CANCELED;
  }

  /**
   * Проверка, неуспешен ли платёж
   */
  get isFailed(): boolean {
    return this.status === PaymentStatus.FAILED;
  }

  /**
   * Проверка, был ли возврат
   */
  get hasRefunds(): boolean {
    return this.refunds.length > 0;
  }

  /**
   * Проверка, полностью ли возвращён платёж
   */
  get isFullyRefunded(): boolean {
    return this.status === PaymentStatus.REFUNDED;
  }

  /**
   * Оставшаяся сумма (после возвратов)
   */
  get remainingAmount(): number {
    return Number(this.amount) - Number(this.refundedAmount);
  }

  /**
   * Добавление записи в историю статусов
   */
  addStatusHistoryEntry(
    status: PaymentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): void {
    this.statusHistory.push({
      status,
      timestamp: new Date(),
      reason,
      metadata,
    });
  }

  /**
   * Обновление статуса с записью в историю
   */
  updateStatus(
    newStatus: PaymentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): void {
    const oldStatus = this.status;
    this.status = newStatus;
    this.addStatusHistoryEntry(newStatus, reason, {
      ...metadata,
      previousStatus: oldStatus,
    });

    // Обновляем временные метки
    if (newStatus === PaymentStatus.SUCCEEDED && !this.paidAt) {
      this.paidAt = new Date();
    } else if (newStatus === PaymentStatus.CANCELED && !this.canceledAt) {
      this.canceledAt = new Date();
    }
  }

  /**
   * Добавление информации о возврате
   */
  addRefund(refund: PaymentRefundInfo): void {
    this.refunds.push(refund);
    if (refund.status === "succeeded") {
      this.refundedAmount = Number(this.refundedAmount) + refund.amount;
      // Обновляем статус если полный возврат
      if (this.remainingAmount <= 0) {
        this.updateStatus(PaymentStatus.REFUNDED, "Full refund completed");
      } else {
        this.updateStatus(
          PaymentStatus.PARTIALLY_REFUNDED,
          `Partial refund: ${refund.amount}`
        );
      }
    }
  }

  /**
   * Маппинг статуса платежа в статус для сущности (Order/Booking)
   */
  toEntityPaymentStatus(): EntityPaymentStatus {
    switch (this.status) {
      case PaymentStatus.SUCCEEDED:
        return EntityPaymentStatus.PAID;
      case PaymentStatus.PENDING:
      case PaymentStatus.WAITING_FOR_CAPTURE:
        return EntityPaymentStatus.PENDING;
      case PaymentStatus.CANCELED:
      case PaymentStatus.FAILED:
        return EntityPaymentStatus.FAILED;
      case PaymentStatus.REFUNDED:
        return EntityPaymentStatus.REFUNDED;
      case PaymentStatus.PARTIALLY_REFUNDED:
        return EntityPaymentStatus.PARTIALLY_REFUNDED;
      default:
        return EntityPaymentStatus.PENDING;
    }
  }
}

