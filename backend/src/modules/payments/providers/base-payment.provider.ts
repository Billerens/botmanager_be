import { Logger } from "@nestjs/common";
import {
  IPaymentProvider,
  ValidationResult,
  PaymentRequest,
  PaymentResult,
  PaymentStatusInfo,
  RefundRequest,
  RefundResult,
  WebhookData,
  ProviderInfo,
  PaymentError,
  PaymentErrorCode,
  RetryOptions,
} from "../interfaces/payment-provider.interface";
import { PaymentProvider } from "../schemas/payment.schemas";

/**
 * Базовый абстрактный класс для всех платежных провайдеров
 */
export abstract class BasePaymentProvider implements IPaymentProvider {
  protected readonly logger: Logger;
  protected readonly testMode: boolean;

  constructor(
    protected readonly providerType: PaymentProvider,
    testMode: boolean = false
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
    this.testMode = testMode;
  }

  /**
   * Информация о провайдере (должна быть реализована в наследниках)
   */
  abstract get info(): ProviderInfo;

  /**
   * Валидация конфигурации
   */
  abstract validateConfig(): Promise<ValidationResult>;

  /**
   * Создание платежа
   */
  abstract createPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Получение статуса платежа
   */
  abstract getPaymentStatus(
    externalPaymentId: string
  ): Promise<PaymentStatusInfo>;

  /**
   * Возврат платежа
   */
  abstract refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * Отмена платежа
   */
  abstract cancelPayment(externalPaymentId: string): Promise<PaymentStatusInfo>;

  /**
   * Подтверждение платежа
   */
  abstract capturePayment(
    externalPaymentId: string,
    amount?: number
  ): Promise<PaymentStatusInfo>;

  /**
   * Парсинг webhook
   */
  abstract parseWebhook(payload: any, signature?: string): Promise<WebhookData>;

  /**
   * Верификация подписи webhook
   */
  abstract verifyWebhookSignature(
    payload: any,
    signature: string
  ): Promise<boolean>;

  /**
   * Выполнение операции с повторными попытками
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
    }
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Проверяем, можно ли повторить
        if (!this.isRetryableError(error, options.retryableErrors)) {
          throw error;
        }

        if (attempt < options.maxAttempts) {
          const delay =
            options.delayMs * Math.pow(options.backoffMultiplier, attempt - 1);
          this.logger.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Проверка, можно ли повторить операцию
   */
  protected isRetryableError(error: any, retryableErrors?: string[]): boolean {
    // Сетевые ошибки обычно можно повторить
    if (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND"
    ) {
      return true;
    }

    // Ошибки rate limiting
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }

    // Проверяем кастомный список
    if (retryableErrors && error.code) {
      return retryableErrors.includes(error.code);
    }

    return false;
  }

  /**
   * Создание ошибки платежа
   */
  protected createPaymentError(
    message: string,
    code: PaymentErrorCode,
    retryable: boolean = false,
    originalError?: Error
  ): PaymentError {
    return new PaymentError(
      message,
      code,
      this.providerType,
      retryable,
      originalError
    );
  }

  /**
   * Логирование операции
   */
  protected logOperation(operation: string, data?: Record<string, any>): void {
    this.logger.log(`[${this.providerType}] ${operation}`, {
      testMode: this.testMode,
      ...data,
    });
  }

  /**
   * Логирование ошибки
   */
  protected logError(
    operation: string,
    error: Error,
    data?: Record<string, any>
  ): void {
    this.logger.error(`[${this.providerType}] ${operation} failed`, {
      error: error.message,
      stack: error.stack,
      testMode: this.testMode,
      ...data,
    });
  }

  /**
   * Генерация idempotency key
   */
  protected generateIdempotencyKey(): string {
    return `${this.providerType}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Форматирование суммы для API провайдера
   */
  protected formatAmount(amount: number, decimals: number = 2): string {
    return amount.toFixed(decimals);
  }

  /**
   * Парсинг суммы из ответа провайдера
   */
  protected parseAmount(value: string | number): number {
    if (typeof value === "number") {
      return value;
    }
    return parseFloat(value);
  }

  /**
   * Задержка выполнения
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Маскирование чувствительных данных для логов
   */
  protected maskSensitiveData(data: string): string {
    if (data.length <= 8) {
      return "****";
    }
    return `${data.substring(0, 4)}****${data.substring(data.length - 4)}`;
  }
}
