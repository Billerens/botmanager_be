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

/**
 * Тип сущности, к которой привязаны настройки платежей
 */
export enum PaymentEntityType {
  SHOP = "shop",
  BOOKING_SYSTEM = "booking_system",
  CUSTOM_PAGE = "custom_page",
  BOT = "bot",
}

/**
 * Методы оплаты
 */
export enum PaymentMethodType {
  CARD = "card",
  SBP = "sbp",
  WALLET = "wallet",
  BANK_TRANSFER = "bank_transfer",
  CRYPTO = "crypto",
  APPLE_PAY = "apple_pay",
  GOOGLE_PAY = "google_pay",
}

/**
 * Настройки модуля платежей
 */
export interface PaymentModuleSettings {
  currency: string; // RUB, USD, EUR, etc.
  minAmount?: number;
  maxAmount?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  supportedPaymentMethods: PaymentMethodType[];
  requireCustomerData: boolean;
  allowPartialPayments: boolean;
  sendPaymentConfirmations: boolean;
  sendReceipts: boolean;
  emailForNotifications?: string;
}

/**
 * Сущность PaymentConfig - настройки платежей для любой сущности
 *
 * Универсальное хранилище настроек платежей с полиморфной связью.
 * Может быть привязано к Shop, BookingSystem, CustomPage или Bot.
 */
@Entity("payment_configs")
@Index(["entityType", "entityId"], { unique: true })
@Index(["ownerId"])
export class PaymentConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * Тип сущности (shop, booking_system, custom_page, bot)
   */
  @Column({
    type: "enum",
    enum: PaymentEntityType,
  })
  entityType: PaymentEntityType;

  /**
   * ID связанной сущности
   */
  @Column("uuid")
  entityId: string;

  /**
   * ID владельца (для проверки прав доступа)
   */
  @Column("uuid")
  ownerId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: User;

  /**
   * Глобальное включение платежей для этой сущности
   */
  @Column({ default: false })
  enabled: boolean;

  /**
   * Тестовый режим
   */
  @Column({ default: true })
  testMode: boolean;

  /**
   * Общие настройки модуля платежей
   */
  @Column({ type: "jsonb", default: {} })
  settings: PaymentModuleSettings;

  /**
   * Список активных провайдеров
   */
  @Column({ type: "simple-array", default: "" })
  providers: string[];

  /**
   * Настройки каждого провайдера (зашифрованные)
   * Структура: { yookassa: {...}, stripe: {...}, ... }
   */
  @Column({ type: "jsonb", default: {} })
  providerSettings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ============================================
  // Вычисляемые свойства
  // ============================================

  /**
   * Проверка, активны ли платежи
   */
  get isActive(): boolean {
    return this.enabled && this.providers.length > 0;
  }

  /**
   * Проверка, настроен ли конкретный провайдер
   */
  hasProvider(provider: string): boolean {
    return this.providers.includes(provider);
  }

  /**
   * Получение настроек конкретного провайдера
   */
  getProviderSettings<T = any>(provider: string): T | undefined {
    return this.providerSettings[provider] as T;
  }

  /**
   * Настройки по умолчанию
   */
  static getDefaultSettings(): PaymentModuleSettings {
    return {
      currency: "RUB",
      supportedPaymentMethods: [PaymentMethodType.CARD, PaymentMethodType.SBP],
      requireCustomerData: true,
      allowPartialPayments: false,
      sendPaymentConfirmations: true,
      sendReceipts: true,
    };
  }
}

