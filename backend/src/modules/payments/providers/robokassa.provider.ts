import * as crypto from "crypto";
import axios from "axios";
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
  RobokassaConfig,
  RobokassaConfigSchema,
  PaymentStatus,
  Currency,
} from "../schemas/payment.schemas";

/**
 * Провайдер для Robokassa
 * Документация: https://docs.robokassa.ru/
 */
export class RobokassaProvider extends BasePaymentProvider {
  private config: RobokassaConfig;
  private baseUrl: string;

  constructor(config: RobokassaConfig, testMode: boolean = false) {
    super("robokassa", testMode);
    this.config = config;
    this.baseUrl = testMode
      ? "https://auth.robokassa.ru/Merchant/Index.aspx"
      : "https://auth.robokassa.ru/Merchant/Index.aspx";
  }

  get info(): ProviderInfo {
    return {
      name: "Robokassa",
      type: "robokassa",
      supportedCurrencies: ["RUB", "USD", "EUR"],
      supportedMethods: ["card", "wallet", "bank_transfer", "crypto"],
      testMode: this.testMode,
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    try {
      const result = RobokassaConfigSchema.safeParse(this.config);

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
      const invoiceId =
        request.orderId ||
        `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Формируем подпись
      const signature = this.generateSignature(
        request.amount.value,
        invoiceId,
        this.config.password1
      );

      // Формируем URL для оплаты
      const params = new URLSearchParams({
        MerchantLogin: this.config.merchantLogin,
        OutSum: request.amount.value.toFixed(2),
        InvId: invoiceId,
        Description: request.description || "Оплата заказа",
        SignatureValue: signature,
        Culture: this.config.culture || "ru",
        Encoding: "utf-8",
      });

      // Добавляем тестовый режим
      if (this.testMode || this.config.isTest) {
        params.append("IsTest", "1");
      }

      // Добавляем email если есть
      if (request.customer?.email) {
        params.append("Email", request.customer.email);
      }

      // Добавляем дополнительные параметры
      if (request.metadata) {
        Object.entries(request.metadata).forEach(([key, value]) => {
          params.append(`Shp_${key}`, String(value));
        });
      }

      const paymentUrl = `${this.baseUrl}?${params.toString()}`;

      return {
        id: invoiceId,
        externalId: invoiceId,
        status: "pending",
        amount: request.amount,
        paymentUrl,
        createdAt: new Date(),
        metadata: {
          invoiceId,
          ...request.metadata,
        },
      };
    } catch (error: any) {
      this.logError("createPayment", error, { request });
      throw this.createPaymentError(
        error.message || "Ошибка создания платежа",
        PaymentErrorCode.PROVIDER_ERROR,
        false,
        error
      );
    }
  }

  async getPaymentStatus(
    externalPaymentId: string
  ): Promise<PaymentStatusInfo> {
    this.logOperation("getPaymentStatus", { externalPaymentId });

    try {
      // Robokassa не предоставляет API для проверки статуса
      // Статус обновляется через webhook (ResultURL)
      // Можно использовать XML-интерфейс для проверки

      const signature = this.generateMd5(
        `${this.config.merchantLogin}:${externalPaymentId}:${this.config.password2}`
      );

      const response = await axios.get(
        "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt",
        {
          params: {
            MerchantLogin: this.config.merchantLogin,
            InvoiceID: externalPaymentId,
            Signature: signature,
          },
        }
      );

      // Парсим XML ответ
      const stateMatch = response.data.match(/<StateCode>(\d+)<\/StateCode>/);
      const state = stateMatch ? parseInt(stateMatch[1], 10) : -1;

      return {
        id: externalPaymentId,
        status: this.mapStateToStatus(state),
        amount: {
          value: 0, // Robokassa не возвращает сумму в этом запросе
          currency: "RUB" as Currency,
        },
      };
    } catch (error: any) {
      this.logError("getPaymentStatus", error, { externalPaymentId });

      // Если API недоступен, возвращаем pending
      return {
        id: externalPaymentId,
        status: "pending",
        amount: {
          value: 0,
          currency: "RUB" as Currency,
        },
      };
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    this.logOperation("refund", {
      paymentId: request.paymentId,
      amount: request.amount,
    });

    // Robokassa не поддерживает автоматические возвраты через API
    // Возвраты делаются вручную через личный кабинет
    throw this.createPaymentError(
      "Robokassa не поддерживает автоматические возвраты. Используйте личный кабинет.",
      PaymentErrorCode.REFUND_FAILED,
      false
    );
  }

  async cancelPayment(externalPaymentId: string): Promise<PaymentStatusInfo> {
    this.logOperation("cancelPayment", { externalPaymentId });

    // Robokassa не поддерживает отмену платежей через API
    throw this.createPaymentError(
      "Robokassa не поддерживает отмену платежей через API",
      PaymentErrorCode.PROVIDER_ERROR,
      false
    );
  }

  async capturePayment(
    externalPaymentId: string,
    amount?: number
  ): Promise<PaymentStatusInfo> {
    this.logOperation("capturePayment", { externalPaymentId, amount });

    // Robokassa не поддерживает двухстадийные платежи
    throw this.createPaymentError(
      "Robokassa не поддерживает двухстадийные платежи",
      PaymentErrorCode.PROVIDER_ERROR,
      false
    );
  }

  async parseWebhook(payload: any, signature?: string): Promise<WebhookData> {
    this.logOperation("parseWebhook", {
      invId: payload.InvId,
      outSum: payload.OutSum,
    });

    // Верифицируем подпись
    const isValid = await this.verifyWebhookSignature(
      payload,
      payload.SignatureValue
    );

    if (!isValid) {
      throw this.createPaymentError(
        "Неверная подпись webhook",
        PaymentErrorCode.WEBHOOK_VERIFICATION_FAILED,
        false
      );
    }

    // Извлекаем дополнительные параметры (Shp_*)
    const metadata: Record<string, any> = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (key.startsWith("Shp_")) {
        metadata[key.substring(4)] = value;
      }
    });

    return {
      event: "payment.succeeded",
      paymentId: payload.InvId,
      status: "succeeded",
      amount: {
        value: parseFloat(payload.OutSum),
        currency: "RUB" as Currency,
      },
      metadata,
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(
    payload: any,
    signature: string
  ): Promise<boolean> {
    try {
      // Собираем дополнительные параметры (Shp_*) в отсортированном порядке
      const shpParams: string[] = [];
      Object.keys(payload)
        .filter((key) => key.startsWith("Shp_"))
        .sort()
        .forEach((key) => {
          shpParams.push(`${key}=${payload[key]}`);
        });

      const shpString = shpParams.length > 0 ? `:${shpParams.join(":")}` : "";

      // Формируем строку для проверки подписи ResultURL
      // OutSum:InvId:Password2[:Shp_*]
      const signatureString = `${payload.OutSum}:${payload.InvId}:${this.config.password2}${shpString}`;

      const calculatedSignature = this.generateMd5(signatureString);

      return calculatedSignature.toLowerCase() === signature.toLowerCase();
    } catch (error) {
      this.logError("verifyWebhookSignature", error as Error);
      return false;
    }
  }

  /**
   * Генерация подписи для инициализации платежа
   */
  private generateSignature(
    outSum: number,
    invId: string,
    password: string
  ): string {
    // MerchantLogin:OutSum:InvId:Password1
    const signatureString = `${this.config.merchantLogin}:${outSum.toFixed(2)}:${invId}:${password}`;
    return this.generateMd5(signatureString);
  }

  /**
   * Генерация MD5 хеша
   */
  private generateMd5(data: string): string {
    return crypto.createHash("md5").update(data).digest("hex");
  }

  /**
   * Маппинг состояния в статус
   */
  private mapStateToStatus(state: number): PaymentStatus {
    // Коды состояний Robokassa
    // 5 - операция только инициализирована
    // 10 - операция отменена
    // 50 - деньги зачислены
    // 60 - деньги возвращены
    // 80 - операция приостановлена
    // 100 - операция завершена успешно

    const statusMap: Record<number, PaymentStatus> = {
      5: "pending",
      10: "canceled",
      50: "succeeded",
      60: "refunded",
      80: "pending",
      100: "succeeded",
    };

    return statusMap[state] || "pending";
  }

  /**
   * Генерация ответа для ResultURL (подтверждение получения webhook)
   */
  getSuccessResponse(invId: string): string {
    return `OK${invId}`;
  }
}
