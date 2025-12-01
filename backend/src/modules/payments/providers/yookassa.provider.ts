import { YooCheckout } from "@a2seven/yoo-checkout";
import { BasePaymentProvider } from "./base-payment.provider";
import {
  ValidationResult,
  PaymentRequest,
  PaymentResult,
  PaymentStatusInfo,
  RefundRequest,
  RefundResult,
  WebhookData,
  ProviderInfo,
  PaymentErrorCode,
} from "../interfaces/payment-provider.interface";
import {
  YookassaConfig,
  YookassaConfigSchema,
  PaymentStatus,
  Currency,
} from "../schemas/payment.schemas";

// Типы для YooKassa SDK
interface YooKassaAmount {
  value: string;
  currency: string;
}

interface YooKassaPayment {
  id: string;
  status: string;
  amount: YooKassaAmount;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  created_at: string;
  captured_at?: string;
  canceled_at?: string;
  metadata?: Record<string, any>;
}

interface YooKassaRefund {
  id: string;
  status: string;
  amount: YooKassaAmount;
  created_at: string;
}

/**
 * Провайдер для ЮKassa (YooKassa)
 * Документация: https://yookassa.ru/developers/api
 */
export class YookassaProvider extends BasePaymentProvider {
  private client: YooCheckout;
  private config: YookassaConfig;

  constructor(config: YookassaConfig, testMode: boolean = false) {
    super("yookassa", testMode);
    this.config = config;
    this.client = new YooCheckout({
      shopId: config.shopId,
      secretKey: config.secretKey,
    });
  }

  get info(): ProviderInfo {
    return {
      name: "ЮKassa",
      type: "yookassa",
      supportedCurrencies: ["RUB", "USD", "EUR"],
      supportedMethods: ["card", "sbp", "wallet", "bank_transfer"],
      testMode: this.testMode,
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    try {
      const result = YookassaConfigSchema.safeParse(this.config);

      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map((e) => e.message),
        };
      }

      // Проверяем подключение к API
      try {
        // Пробуем получить информацию о магазине
        await this.client.getPaymentList({ limit: 1 });
      } catch (error: any) {
        if (error.response?.status === 401) {
          return {
            valid: false,
            errors: ["Неверные учетные данные Shop ID или Secret Key"],
          };
        }
        // Другие ошибки могут быть временными
        this.logError("validateConfig", error);
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: ["Ошибка валидации конфигурации"],
      };
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    this.logOperation("createPayment", {
      amount: request.amount,
      orderId: request.orderId,
    });

    try {
      const idempotencyKey =
        request.idempotencyKey || this.generateIdempotencyKey();

      const paymentData: any = {
        amount: {
          value: this.formatAmount(request.amount.value),
          currency: request.amount.currency,
        },
        capture: true, // Автоматическое подтверждение
        confirmation: {
          type: "redirect",
          return_url: request.returnUrl || "https://example.com/return",
        },
        description: request.description,
        metadata: {
          ...request.metadata,
          orderId: request.orderId,
        },
      };

      // Добавляем данные покупателя если есть
      if (request.customer) {
        paymentData.receipt = {
          customer: {
            email: request.customer.email,
            phone: request.customer.phone,
          },
          items: [
            {
              description: request.description || "Оплата заказа",
              quantity: "1",
              amount: {
                value: this.formatAmount(request.amount.value),
                currency: request.amount.currency,
              },
              vat_code: 1, // НДС 20%
            },
          ],
        };
      }

      const payment = (await this.executeWithRetry(() =>
        this.client.createPayment(paymentData, idempotencyKey)
      )) as YooKassaPayment;

      return {
        id: payment.id,
        externalId: payment.id,
        status: this.mapStatus(payment.status),
        amount: {
          value: this.parseAmount(payment.amount.value),
          currency: payment.amount.currency as Currency,
        },
        paymentUrl: payment.confirmation?.confirmation_url,
        createdAt: new Date(payment.created_at),
        metadata: payment.metadata,
      };
    } catch (error: any) {
      this.logError("createPayment", error, { request });
      throw this.createPaymentError(
        error.message || "Ошибка создания платежа",
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error
      );
    }
  }

  async getPaymentStatus(
    externalPaymentId: string
  ): Promise<PaymentStatusInfo> {
    this.logOperation("getPaymentStatus", { externalPaymentId });

    try {
      const payment = (await this.executeWithRetry(() =>
        this.client.getPayment(externalPaymentId)
      )) as YooKassaPayment;

      return {
        id: payment.id,
        status: this.mapStatus(payment.status),
        amount: {
          value: this.parseAmount(payment.amount.value),
          currency: payment.amount.currency as Currency,
        },
        paidAt: payment.captured_at ? new Date(payment.captured_at) : undefined,
        canceledAt: payment.canceled_at
          ? new Date(payment.canceled_at)
          : undefined,
        metadata: payment.metadata,
      };
    } catch (error: any) {
      this.logError("getPaymentStatus", error, { externalPaymentId });

      if (error.response?.status === 404) {
        throw this.createPaymentError(
          "Платеж не найден",
          PaymentErrorCode.PAYMENT_NOT_FOUND,
          false,
          error
        );
      }

      throw this.createPaymentError(
        error.message || "Ошибка получения статуса платежа",
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error
      );
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    this.logOperation("refund", {
      paymentId: request.paymentId,
      amount: request.amount,
    });

    try {
      const idempotencyKey = this.generateIdempotencyKey();

      // Получаем информацию о платеже для определения суммы
      const payment = await this.client.getPayment(request.externalPaymentId);

      const refundData: any = {
        payment_id: request.externalPaymentId,
        amount: {
          value: request.amount
            ? this.formatAmount(request.amount)
            : payment.amount.value,
          currency: request.currency || payment.amount.currency,
        },
      };

      if (request.reason) {
        refundData.description = request.reason;
      }

      const refund = (await this.executeWithRetry(() =>
        this.client.createRefund(refundData, idempotencyKey)
      )) as YooKassaRefund;

      return {
        id: refund.id,
        paymentId: request.paymentId,
        status: this.mapRefundStatus(refund.status),
        amount: {
          value: this.parseAmount(refund.amount.value),
          currency: refund.amount.currency as Currency,
        },
        createdAt: new Date(refund.created_at),
      };
    } catch (error: any) {
      this.logError("refund", error, { request });
      throw this.createPaymentError(
        error.message || "Ошибка возврата платежа",
        PaymentErrorCode.REFUND_FAILED,
        this.isRetryableError(error),
        error
      );
    }
  }

  async cancelPayment(externalPaymentId: string): Promise<PaymentStatusInfo> {
    this.logOperation("cancelPayment", { externalPaymentId });

    try {
      const idempotencyKey = this.generateIdempotencyKey();

      const payment = (await this.executeWithRetry(() =>
        this.client.cancelPayment(externalPaymentId, idempotencyKey)
      )) as YooKassaPayment;

      return {
        id: payment.id,
        status: this.mapStatus(payment.status),
        amount: {
          value: this.parseAmount(payment.amount.value),
          currency: payment.amount.currency as Currency,
        },
        canceledAt: payment.canceled_at
          ? new Date(payment.canceled_at)
          : new Date(),
        metadata: payment.metadata,
      };
    } catch (error: any) {
      this.logError("cancelPayment", error, { externalPaymentId });
      throw this.createPaymentError(
        error.message || "Ошибка отмены платежа",
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error
      );
    }
  }

  async capturePayment(
    externalPaymentId: string,
    amount?: number
  ): Promise<PaymentStatusInfo> {
    this.logOperation("capturePayment", { externalPaymentId, amount });

    try {
      const idempotencyKey = this.generateIdempotencyKey();

      // Получаем информацию о платеже
      const paymentInfo = await this.client.getPayment(externalPaymentId);

      const captureData: any = {
        amount: {
          value: amount ? this.formatAmount(amount) : paymentInfo.amount.value,
          currency: paymentInfo.amount.currency,
        },
      };

      const payment = (await this.executeWithRetry(() =>
        this.client.capturePayment(
          externalPaymentId,
          captureData,
          idempotencyKey
        )
      )) as YooKassaPayment;

      return {
        id: payment.id,
        status: this.mapStatus(payment.status),
        amount: {
          value: this.parseAmount(payment.amount.value),
          currency: payment.amount.currency as Currency,
        },
        paidAt: payment.captured_at
          ? new Date(payment.captured_at)
          : new Date(),
        metadata: payment.metadata,
      };
    } catch (error: any) {
      this.logError("capturePayment", error, { externalPaymentId, amount });
      throw this.createPaymentError(
        error.message || "Ошибка подтверждения платежа",
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error
      );
    }
  }

  async parseWebhook(payload: any, signature?: string): Promise<WebhookData> {
    this.logOperation("parseWebhook", { event: payload.event });

    // Верифицируем подпись если предоставлена
    if (signature) {
      const isValid = await this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw this.createPaymentError(
          "Неверная подпись webhook",
          PaymentErrorCode.WEBHOOK_VERIFICATION_FAILED,
          false
        );
      }
    }

    const object = payload.object;

    return {
      event: payload.event,
      paymentId: object.id,
      status: this.mapStatus(object.status),
      amount: object.amount
        ? {
            value: this.parseAmount(object.amount.value),
            currency: object.amount.currency as Currency,
          }
        : undefined,
      metadata: object.metadata,
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(
    payload: any,
    signature: string
  ): Promise<boolean> {
    // YooKassa использует IP-whitelist для webhook'ов
    // Для дополнительной безопасности можно проверить структуру payload
    // В реальном приложении нужно проверять IP-адрес запроса

    // Базовая проверка структуры
    if (!payload.event || !payload.object) {
      return false;
    }

    // Проверяем что event валидный
    const validEvents = [
      "payment.waiting_for_capture",
      "payment.succeeded",
      "payment.canceled",
      "refund.succeeded",
    ];

    return validEvents.includes(payload.event);
  }

  /**
   * Маппинг статуса YooKassa в общий статус
   */
  private mapStatus(yookassaStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: "pending",
      waiting_for_capture: "waiting_for_capture",
      succeeded: "succeeded",
      canceled: "canceled",
    };

    return statusMap[yookassaStatus] || "pending";
  }

  /**
   * Маппинг статуса возврата
   */
  private mapRefundStatus(status: string): "pending" | "succeeded" | "failed" {
    const statusMap: Record<string, "pending" | "succeeded" | "failed"> = {
      pending: "pending",
      succeeded: "succeeded",
      canceled: "failed",
    };

    return statusMap[status] || "pending";
  }
}
