// Module
export * from "./payments.module";
export * from "./payments.service";
export * from "./payments.controller";

// DTOs
export * from "./dto/payment.dto";

// Schemas
export * from "./schemas/payment.schemas";

// Interfaces - явный реэкспорт без конфликтующих типов (RefundRequest из schemas)
export {
  IPaymentProvider,
  ValidationResult,
  PaymentRequest,
  PaymentResult,
  PaymentStatusInfo,
  WebhookData,
  ProviderInfo,
  PaymentError,
  PaymentErrorCode,
  RetryOptions,
} from "./interfaces/payment-provider.interface";

// RefundRequest и RefundResult используем из интерфейсов для провайдеров
export type { RefundRequest as ProviderRefundRequest } from "./interfaces/payment-provider.interface";
export type { RefundResult as ProviderRefundResult } from "./interfaces/payment-provider.interface";

// Providers
export * from "./providers";
