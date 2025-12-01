import { z } from "zod";

// ============================================
// Enums
// ============================================

export const PaymentProviderEnum = z.enum([
  "yookassa",
  "tinkoff",
  "robokassa",
  "stripe",
  "crypto_trc20",
]);

export const PaymentStatusEnum = z.enum([
  "pending",
  "waiting_for_capture",
  "succeeded",
  "canceled",
  "refunded",
  "failed",
]);

export const PaymentMethodEnum = z.enum([
  "card",
  "sbp",
  "wallet",
  "bank_transfer",
  "crypto",
  "apple_pay",
  "google_pay",
]);

export const CurrencyEnum = z.enum(["RUB", "USD", "EUR", "GBP"]);

// Источники курсов для конвертации криптовалют
export const CryptoExchangeEnum = z.enum([
  "binance", // Binance API
  "coingecko", // CoinGecko API
  "coinbase", // Coinbase API
  "kraken", // Kraken API
  "manual", // Ручной курс
]);

export const TaxSystemEnum = z.enum([
  "osn", // ОСН
  "usn_income", // УСН доходы
  "usn_income_outcome", // УСН доходы-расходы
  "envd", // ЕНВД
  "eshn", // ЕСХН
  "patent", // Патент
]);

// ============================================
// Provider Configs
// ============================================

export const YookassaConfigSchema = z.object({
  shopId: z
    .string()
    .min(1, "Shop ID обязателен")
    .regex(/^\d+$/, "Shop ID должен содержать только цифры"),
  secretKey: z
    .string()
    .min(1, "Secret Key обязателен")
    .min(10, "Secret Key слишком короткий"),
  agentId: z.string().optional(),
  taxSystem: z.number().min(1).max(6).optional(),
});

export const TinkoffConfigSchema = z.object({
  terminalKey: z
    .string()
    .min(1, "Terminal Key обязателен")
    .min(10, "Terminal Key слишком короткий"),
  secretKey: z
    .string()
    .min(1, "Secret Key обязателен")
    .min(10, "Secret Key слишком короткий"),
  taxation: TaxSystemEnum.optional(),
  ffdVersion: z.enum(["1.05", "1.1", "1.2"]).optional(),
});

export const RobokassaConfigSchema = z.object({
  merchantLogin: z
    .string()
    .min(1, "Merchant Login обязателен")
    .min(3, "Merchant Login слишком короткий"),
  password1: z
    .string()
    .min(1, "Password 1 обязателен")
    .min(6, "Password 1 слишком короткий"),
  password2: z
    .string()
    .min(1, "Password 2 обязателен")
    .min(6, "Password 2 слишком короткий"),
  password3: z.string().optional(),
  password4: z.string().optional(),
  culture: z.enum(["ru", "en"]).optional().default("ru"),
  isTest: z.boolean().optional().default(false),
});

export const StripeConfigSchema = z.object({
  publishableKey: z
    .string()
    .min(1, "Publishable Key обязателен")
    .regex(/^pk_(test|live)_/, "Неверный формат Publishable Key"),
  secretKey: z
    .string()
    .min(1, "Secret Key обязателен")
    .regex(/^sk_(test|live)_/, "Неверный формат Secret Key"),
  webhookSecret: z
    .string()
    .min(1, "Webhook Secret обязателен")
    .regex(/^whsec_/, "Неверный формат Webhook Secret"),
  accountId: z
    .string()
    .regex(/^acct_/, "Неверный формат Account ID")
    .optional(),
  applicationFee: z.number().min(0).max(100).optional(),
});

export const CryptoTRC20ConfigSchema = z.object({
  // Адрес TRC-20 кошелька для приёма USDT
  walletAddress: z
    .string()
    .min(1, "Адрес кошелька обязателен")
    .regex(/^T[a-zA-Z0-9]{33}$/, "Неверный формат TRC-20 адреса"),
  // Количество подтверждений для принятия платежа (1-20)
  confirmationsRequired: z.number().min(1).max(20).default(1),
  // Интервал проверки в секундах (10-300)
  checkIntervalSeconds: z.number().min(10).max(300).default(30),
  // Время жизни счёта в минутах (5-1440)
  expirationMinutes: z.number().min(5).max(1440).default(60),
  // Допуск по сумме (для учёта комиссий сети)
  amountTolerancePercent: z.number().min(0).max(5).default(0.5),
  // Использовать testnet (Nile/Shasta)
  useTestnet: z.boolean().default(false),
  // API ключ TronGrid (опционально, для повышенных лимитов)
  tronGridApiKey: z.string().optional(),
  // Источник курса для конвертации фиат -> USDT
  exchangeRateSource: CryptoExchangeEnum.default("binance"),
  // Ручной курс (используется если exchangeRateSource = "manual")
  manualExchangeRate: z.number().positive().optional(),
  // Наценка/скидка к курсу в процентах (-10% до +10%)
  exchangeRateMarkup: z.number().min(-10).max(10).default(0),
});

// ============================================
// Module Settings
// ============================================

export const ModulePaymentSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  currency: CurrencyEnum.default("RUB"),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  // Разрешаем пустую строку или валидный URL
  webhookUrl: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.string().url("Неверный URL").optional())
    .optional(),
  webhookSecret: z.string().optional(),
  supportedPaymentMethods: z.array(PaymentMethodEnum).default(["card", "sbp"]),
  requireCustomerData: z.boolean().default(true),
  allowPartialPayments: z.boolean().default(false),
  sendPaymentConfirmations: z.boolean().default(true),
  sendReceipts: z.boolean().default(true),
  // Разрешаем пустую строку или валидный email
  emailForNotifications: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.string().email("Неверный email").optional())
    .optional(),
});

export const ModuleProviderSettingsSchema = z.object({
  yookassa: YookassaConfigSchema.optional(),
  tinkoff: TinkoffConfigSchema.optional(),
  robokassa: RobokassaConfigSchema.optional(),
  stripe: StripeConfigSchema.optional(),
  crypto_trc20: CryptoTRC20ConfigSchema.optional(),
});

export const ModuleConfigSchema = z.object({
  settings: ModulePaymentSettingsSchema,
  providers: z.array(PaymentProviderEnum).default([]),
  providerSettings: ModuleProviderSettingsSchema.default({}),
});

// ============================================
// Global Settings
// ============================================

export const GlobalPaymentSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  testMode: z.boolean().default(true),
});

export const PaymentSettingsSchema = z.object({
  global: GlobalPaymentSettingsSchema,
  modules: z.object({
    shop: ModuleConfigSchema,
    booking: ModuleConfigSchema,
    api: ModuleConfigSchema,
  }),
});

// ============================================
// Payment Request/Response
// ============================================

export const AmountSchema = z.object({
  value: z.number().positive("Сумма должна быть положительной"),
  currency: CurrencyEnum,
});

export const CustomerDataSchema = z.object({
  email: z.string().email("Неверный email").optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Неверный формат телефона")
    .optional(),
  fullName: z.string().max(256).optional(),
});

export const CreatePaymentRequestSchema = z.object({
  botId: z.string().uuid("Неверный формат Bot ID"),
  module: z.enum(["shop", "booking", "api"]),
  provider: PaymentProviderEnum,
  amount: AmountSchema,
  description: z.string().max(256).optional(),
  orderId: z.string().optional(),
  customer: CustomerDataSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  returnUrl: z.string().url("Неверный URL возврата").optional(),
  cancelUrl: z.string().url("Неверный URL отмены").optional(),
});

export const PaymentResponseSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  provider: PaymentProviderEnum,
  status: PaymentStatusEnum,
  amount: AmountSchema,
  paymentUrl: z.string().url().optional(),
  createdAt: z.date(),
  paidAt: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const RefundRequestSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive().optional(), // Если не указан - полный возврат
  reason: z.string().max(256).optional(),
});

export const RefundResponseSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  amount: AmountSchema,
  status: z.enum(["pending", "succeeded", "failed"]),
  createdAt: z.date(),
});

// ============================================
// Webhook
// ============================================

export const WebhookPayloadSchema = z.object({
  provider: PaymentProviderEnum,
  event: z.string(),
  paymentId: z.string(),
  status: PaymentStatusEnum,
  amount: AmountSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  rawData: z.any(),
});

// ============================================
// Type exports
// ============================================

export type PaymentProvider = z.infer<typeof PaymentProviderEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type Currency = z.infer<typeof CurrencyEnum>;
export type TaxSystem = z.infer<typeof TaxSystemEnum>;

export type YookassaConfig = z.infer<typeof YookassaConfigSchema>;
export type TinkoffConfig = z.infer<typeof TinkoffConfigSchema>;
export type RobokassaConfig = z.infer<typeof RobokassaConfigSchema>;
export type StripeConfig = z.infer<typeof StripeConfigSchema>;
export type CryptoTRC20Config = z.infer<typeof CryptoTRC20ConfigSchema>;
export type CryptoExchange = z.infer<typeof CryptoExchangeEnum>;

export type ModulePaymentSettings = z.infer<typeof ModulePaymentSettingsSchema>;
export type ModuleProviderSettings = z.infer<
  typeof ModuleProviderSettingsSchema
>;
export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
export type GlobalPaymentSettings = z.infer<typeof GlobalPaymentSettingsSchema>;
export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>;

export type Amount = z.infer<typeof AmountSchema>;
export type CustomerData = z.infer<typeof CustomerDataSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type RefundRequest = z.infer<typeof RefundRequestSchema>;
export type RefundResponse = z.infer<typeof RefundResponseSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
