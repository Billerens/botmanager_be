import {
  PaymentProvider,
  PaymentStatus,
  Amount,
  CustomerData,
  Currency,
} from "../schemas/payment.schemas";

/**
 * Результат валидации конфигурации провайдера
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Запрос на создание платежа
 */
export interface PaymentRequest {
  amount: Amount;
  description?: string;
  orderId?: string;
  customer?: CustomerData;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
}

/**
 * Ответ после создания платежа
 */
export interface PaymentResult {
  id: string;
  externalId: string;
  status: PaymentStatus;
  amount: Amount;
  paymentUrl?: string;
  confirmationToken?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Запрос на возврат
 */
export interface RefundRequest {
  paymentId: string;
  externalPaymentId: string;
  amount?: number;
  currency?: Currency;
  reason?: string;
}

/**
 * Результат возврата
 */
export interface RefundResult {
  id: string;
  paymentId: string;
  status: "pending" | "succeeded" | "failed";
  amount: Amount;
  createdAt: Date;
}

/**
 * Информация о статусе платежа
 */
export interface PaymentStatusInfo {
  id: string;
  status: PaymentStatus;
  amount: Amount;
  paidAt?: Date;
  canceledAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Данные webhook от провайдера
 */
export interface WebhookData {
  event: string;
  paymentId: string;
  status: PaymentStatus;
  amount?: Amount;
  metadata?: Record<string, any>;
  rawPayload: any;
}

/**
 * Информация о провайдере
 */
export interface ProviderInfo {
  name: string;
  type: PaymentProvider;
  supportedCurrencies: Currency[];
  supportedMethods: string[];
  testMode: boolean;
}

/**
 * Интерфейс платежного провайдера
 */
export interface IPaymentProvider {
  /**
   * Информация о провайдере
   */
  readonly info: ProviderInfo;

  /**
   * Валидация конфигурации провайдера
   */
  validateConfig(): Promise<ValidationResult>;

  /**
   * Создание платежа
   */
  createPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Получение статуса платежа
   */
  getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusInfo>;

  /**
   * Возврат платежа (полный или частичный)
   */
  refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * Отмена платежа (до его подтверждения)
   */
  cancelPayment(externalPaymentId: string): Promise<PaymentStatusInfo>;

  /**
   * Подтверждение платежа (для двухстадийных платежей)
   */
  capturePayment(
    externalPaymentId: string,
    amount?: number
  ): Promise<PaymentStatusInfo>;

  /**
   * Парсинг webhook данных
   */
  parseWebhook(payload: any, signature?: string): Promise<WebhookData>;

  /**
   * Верификация подписи webhook
   */
  verifyWebhookSignature(payload: any, signature: string): Promise<boolean>;
}

/**
 * Конфигурация провайдера (объединение всех типов)
 */
export type ProviderConfig =
  | import("../schemas/payment.schemas").YookassaConfig
  | import("../schemas/payment.schemas").TinkoffConfig
  | import("../schemas/payment.schemas").RobokassaConfig
  | import("../schemas/payment.schemas").StripeConfig
  | import("../schemas/payment.schemas").CryptoTRC20Config;

/**
 * Фабрика провайдеров
 */
export interface IPaymentProviderFactory {
  create(type: PaymentProvider, config: ProviderConfig): IPaymentProvider;
  getSupportedProviders(): PaymentProvider[];
}

/**
 * Опции для повторных попыток
 */
export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Ошибка платежа
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: PaymentProvider,
    public readonly retryable: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * Коды ошибок платежей
 */
export enum PaymentErrorCode {
  INVALID_CONFIG = "INVALID_CONFIG",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INVALID_CURRENCY = "INVALID_CURRENCY",
  PAYMENT_DECLINED = "PAYMENT_DECLINED",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  REFUND_FAILED = "REFUND_FAILED",
  WEBHOOK_VERIFICATION_FAILED = "WEBHOOK_VERIFICATION_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  UNAUTHORIZED = "UNAUTHORIZED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}
