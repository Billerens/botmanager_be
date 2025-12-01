import * as TinkoffSDK from "@jfkz/tinkoff-payment-sdk";
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
  TinkoffConfig,
  TinkoffConfigSchema,
  PaymentStatus,
  Currency,
} from "../schemas/payment.schemas";
import * as crypto from "crypto";

// Типы для Tinkoff SDK
interface TinkoffResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  PaymentId?: string | number;
  PaymentURL?: string;
  Status?: string;
  Amount?: number;
  OriginalAmount?: number;
  DATA?: Record<string, any>;
}

/**
 * Провайдер для Тинькофф Оплаты
 * Документация: https://www.tinkoff.ru/kassa/develop/api/payments/
 */
export class TinkoffProvider extends BasePaymentProvider {
  private client: any;
  private config: TinkoffConfig;

  constructor(config: TinkoffConfig, testMode: boolean = false) {
    super("tinkoff", testMode);
    this.config = config;
    // Используем default export или конструктор
    const TinkoffCheckout =
      (TinkoffSDK as any).default ||
      (TinkoffSDK as any).TinkoffCheckout ||
      TinkoffSDK;
    this.client = new TinkoffCheckout(config.terminalKey, config.secretKey);
  }

  get info(): ProviderInfo {
    return {
      name: "Тинькофф Оплата",
      type: "tinkoff",
      supportedCurrencies: ["RUB"],
      supportedMethods: ["card", "sbp"],
      testMode: this.testMode,
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    try {
      const result = TinkoffConfigSchema.safeParse(this.config);

      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map((e) => e.message),
        };
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
      // Тинькофф работает с копейками
      const amountInKopecks = Math.round(request.amount.value * 100);

      const orderId =
        request.orderId ||
        `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const paymentData: any = {
        Amount: amountInKopecks,
        OrderId: orderId,
        Description: request.description,
        SuccessURL: request.returnUrl,
        FailURL: request.cancelUrl,
        DATA: {
          ...request.metadata,
        },
      };

      // Добавляем данные покупателя
      if (request.customer) {
        if (request.customer.email) {
          paymentData.DATA.Email = request.customer.email;
        }
        if (request.customer.phone) {
          paymentData.DATA.Phone = request.customer.phone;
        }
      }

      // Добавляем чек если нужно
      if (request.customer?.email || request.customer?.phone) {
        paymentData.Receipt = {
          Email: request.customer?.email,
          Phone: request.customer?.phone,
          Taxation: this.config.taxation || "osn",
          Items: [
            {
              Name: request.description || "Оплата заказа",
              Price: amountInKopecks,
              Quantity: 1,
              Amount: amountInKopecks,
              Tax: "vat20",
            },
          ],
        };
      }

      const response = (await this.executeWithRetry(() =>
        this.client.init(paymentData)
      )) as TinkoffResponse;

      if (!response.Success) {
        throw new Error(response.Message || "Ошибка создания платежа");
      }

      return {
        id: String(response.PaymentId),
        externalId: String(response.PaymentId),
        status: "pending" as PaymentStatus,
        amount: request.amount,
        paymentUrl: response.PaymentURL,
        createdAt: new Date(),
        metadata: {
          orderId,
          ...request.metadata,
        },
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
      const response = (await this.executeWithRetry(() =>
        this.client.getState({ PaymentId: externalPaymentId })
      )) as TinkoffResponse;

      if (!response.Success) {
        throw new Error(response.Message || "Ошибка получения статуса");
      }

      return {
        id: String(response.PaymentId),
        status: this.mapStatus(response.Status || ""),
        amount: {
          value: (response.Amount || 0) / 100, // Конвертируем из копеек
          currency: "RUB" as Currency,
        },
        metadata: response.DATA,
      };
    } catch (error: any) {
      this.logError("getPaymentStatus", error, { externalPaymentId });
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
      // Получаем информацию о платеже
      const paymentInfo = await this.getPaymentStatus(
        request.externalPaymentId
      );

      // Тинькофф работает с копейками
      const amountInKopecks = request.amount
        ? Math.round(request.amount * 100)
        : Math.round(paymentInfo.amount.value * 100);

      const response = (await this.executeWithRetry(() =>
        this.client.cancel({
          PaymentId: request.externalPaymentId,
          Amount: amountInKopecks,
        })
      )) as TinkoffResponse;

      if (!response.Success) {
        throw new Error(response.Message || "Ошибка возврата");
      }

      return {
        id: `refund_${Date.now()}`,
        paymentId: request.paymentId,
        status: response.Status === "REFUNDED" ? "succeeded" : "pending",
        amount: {
          value: amountInKopecks / 100,
          currency: "RUB" as Currency,
        },
        createdAt: new Date(),
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
      const response = (await this.executeWithRetry(() =>
        this.client.cancel({ PaymentId: externalPaymentId })
      )) as TinkoffResponse;

      if (!response.Success) {
        throw new Error(response.Message || "Ошибка отмены платежа");
      }

      return {
        id: String(response.PaymentId),
        status: this.mapStatus(response.Status || ""),
        amount: {
          value: (response.OriginalAmount || 0) / 100,
          currency: "RUB" as Currency,
        },
        canceledAt: new Date(),
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
      const confirmData: any = {
        PaymentId: externalPaymentId,
      };

      if (amount) {
        confirmData.Amount = Math.round(amount * 100);
      }

      const response = (await this.executeWithRetry(() =>
        this.client.confirm(confirmData)
      )) as TinkoffResponse;

      if (!response.Success) {
        throw new Error(response.Message || "Ошибка подтверждения платежа");
      }

      return {
        id: String(response.PaymentId),
        status: this.mapStatus(response.Status || ""),
        amount: {
          value: (response.Amount || 0) / 100,
          currency: "RUB" as Currency,
        },
        paidAt: new Date(),
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
    this.logOperation("parseWebhook", { status: payload.Status });

    // Верифицируем подпись
    if (signature || payload.Token) {
      const isValid = await this.verifyWebhookSignature(
        payload,
        signature || payload.Token
      );
      if (!isValid) {
        throw this.createPaymentError(
          "Неверная подпись webhook",
          PaymentErrorCode.WEBHOOK_VERIFICATION_FAILED,
          false
        );
      }
    }

    return {
      event: `payment.${payload.Status.toLowerCase()}`,
      paymentId: payload.PaymentId.toString(),
      status: this.mapStatus(payload.Status),
      amount: payload.Amount
        ? {
            value: payload.Amount / 100,
            currency: "RUB" as Currency,
          }
        : undefined,
      metadata: payload.DATA,
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(payload: any, token: string): Promise<boolean> {
    try {
      // Формируем строку для проверки подписи
      const params: Record<string, any> = { ...payload };
      delete params.Token;

      // Добавляем секретный ключ
      params.Password = this.config.secretKey;

      // Сортируем параметры по ключу
      const sortedKeys = Object.keys(params).sort();

      // Конкатенируем значения
      const values = sortedKeys.map((key) => params[key]).join("");

      // Вычисляем SHA256
      const calculatedToken = crypto
        .createHash("sha256")
        .update(values)
        .digest("hex");

      return calculatedToken.toLowerCase() === token.toLowerCase();
    } catch (error) {
      this.logError("verifyWebhookSignature", error as Error);
      return false;
    }
  }

  /**
   * Маппинг статуса Tinkoff в общий статус
   */
  private mapStatus(tinkoffStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      NEW: "pending",
      FORM_SHOWED: "pending",
      AUTHORIZING: "pending",
      AUTHORIZED: "waiting_for_capture",
      CONFIRMING: "pending",
      CONFIRMED: "succeeded",
      REVERSING: "pending",
      REVERSED: "canceled",
      REFUNDING: "pending",
      REFUNDED: "refunded",
      PARTIAL_REFUNDED: "refunded",
      REJECTED: "failed",
      CANCELED: "canceled",
    };

    return statusMap[tinkoffStatus] || "pending";
  }
}
