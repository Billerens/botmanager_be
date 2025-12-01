import Stripe from 'stripe';
import { BasePaymentProvider } from './base-payment.provider';
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
} from '../interfaces/payment-provider.interface';
import {
  StripeConfig,
  StripeConfigSchema,
  PaymentStatus,
  Currency,
} from '../schemas/payment.schemas';

/**
 * Провайдер для Stripe
 * Документация: https://stripe.com/docs/api
 */
export class StripeProvider extends BasePaymentProvider {
  private client: Stripe;
  private config: StripeConfig;

  constructor(config: StripeConfig, testMode: boolean = false) {
    super('stripe', testMode);
    this.config = config;
    this.client = new Stripe(config.secretKey, {
      apiVersion: '2025-11-17.clover',
    });
  }

  get info(): ProviderInfo {
    return {
      name: 'Stripe',
      type: 'stripe',
      supportedCurrencies: ['RUB', 'USD', 'EUR', 'GBP'],
      supportedMethods: ['card', 'apple_pay', 'google_pay', 'bank_transfer'],
      testMode: this.testMode,
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    try {
      const result = StripeConfigSchema.safeParse(this.config);

      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map((e) => e.message),
        };
      }

      // Проверяем подключение к API
      try {
        await this.client.balance.retrieve();
      } catch (error: any) {
        if (error.type === 'StripeAuthenticationError') {
          return {
            valid: false,
            errors: ['Неверный Secret Key'],
          };
        }
        this.logError('validateConfig', error);
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: ['Ошибка валидации конфигурации'],
      };
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    this.logOperation('createPayment', {
      amount: request.amount,
      orderId: request.orderId,
    });

    try {
      // Stripe работает с минимальными единицами валюты (центы, копейки)
      const amountInSmallestUnit = this.convertToSmallestUnit(
        request.amount.value,
        request.amount.currency,
      );

      // Создаем Checkout Session для редиректа на страницу оплаты
      const sessionData: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: request.amount.currency.toLowerCase(),
              product_data: {
                name: request.description || 'Оплата заказа',
              },
              unit_amount: amountInSmallestUnit,
            },
            quantity: 1,
          },
        ],
        success_url:
          request.returnUrl || 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: request.cancelUrl || 'https://example.com/cancel',
        metadata: {
          orderId: request.orderId || '',
          ...request.metadata,
        },
      };

      // Добавляем email покупателя если есть
      if (request.customer?.email) {
        sessionData.customer_email = request.customer.email;
      }

      // Добавляем application fee если настроен (для Connect)
      if (this.config.applicationFee && this.config.accountId) {
        sessionData.payment_intent_data = {
          application_fee_amount: Math.round(
            amountInSmallestUnit * (this.config.applicationFee / 100),
          ),
          transfer_data: {
            destination: this.config.accountId,
          },
        };
      }

      const session = await this.executeWithRetry(() =>
        this.client.checkout.sessions.create(sessionData),
      );

      return {
        id: session.id,
        externalId: session.id,
        status: 'pending',
        amount: request.amount,
        paymentUrl: session.url || undefined,
        confirmationToken: session.id,
        createdAt: new Date(session.created * 1000),
        metadata: session.metadata as Record<string, any>,
      };
    } catch (error: any) {
      this.logError('createPayment', error, { request });
      throw this.createPaymentError(
        error.message || 'Ошибка создания платежа',
        this.mapStripeErrorCode(error),
        this.isRetryableError(error),
        error,
      );
    }
  }

  async getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusInfo> {
    this.logOperation('getPaymentStatus', { externalPaymentId });

    try {
      // Проверяем, это session ID или payment intent ID
      let paymentIntent: Stripe.PaymentIntent;

      if (externalPaymentId.startsWith('cs_')) {
        // Это Checkout Session ID
        const session = await this.client.checkout.sessions.retrieve(
          externalPaymentId,
        );
        if (!session.payment_intent) {
          return {
            id: externalPaymentId,
            status: this.mapSessionStatus(session.status),
            amount: {
              value: (session.amount_total || 0) / 100,
              currency: (session.currency?.toUpperCase() || 'USD') as Currency,
            },
            metadata: session.metadata as Record<string, any>,
          };
        }
        paymentIntent = await this.client.paymentIntents.retrieve(
          session.payment_intent as string,
        );
      } else {
        // Это Payment Intent ID
        paymentIntent = await this.client.paymentIntents.retrieve(
          externalPaymentId,
        );
      }

      return {
        id: paymentIntent.id,
        status: this.mapPaymentIntentStatus(paymentIntent.status),
        amount: {
          value: this.convertFromSmallestUnit(
            paymentIntent.amount,
            paymentIntent.currency.toUpperCase() as Currency,
          ),
          currency: paymentIntent.currency.toUpperCase() as Currency,
        },
        paidAt: paymentIntent.status === 'succeeded'
          ? new Date()
          : undefined,
        canceledAt: paymentIntent.canceled_at
          ? new Date(paymentIntent.canceled_at * 1000)
          : undefined,
        metadata: paymentIntent.metadata as Record<string, any>,
      };
    } catch (error: any) {
      this.logError('getPaymentStatus', error, { externalPaymentId });

      if (error.code === 'resource_missing') {
        throw this.createPaymentError(
          'Платеж не найден',
          PaymentErrorCode.PAYMENT_NOT_FOUND,
          false,
          error,
        );
      }

      throw this.createPaymentError(
        error.message || 'Ошибка получения статуса платежа',
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error,
      );
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    this.logOperation('refund', {
      paymentId: request.paymentId,
      amount: request.amount,
    });

    try {
      // Получаем payment intent для session
      let paymentIntentId = request.externalPaymentId;

      if (paymentIntentId.startsWith('cs_')) {
        const session = await this.client.checkout.sessions.retrieve(
          paymentIntentId,
        );
        paymentIntentId = session.payment_intent as string;
      }

      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (request.amount) {
        const currency = request.currency || 'USD';
        refundData.amount = this.convertToSmallestUnit(request.amount, currency);
      }

      if (request.reason) {
        refundData.reason = 'requested_by_customer';
        refundData.metadata = { reason: request.reason };
      }

      const refund = await this.executeWithRetry(() =>
        this.client.refunds.create(refundData),
      );

      return {
        id: refund.id,
        paymentId: request.paymentId,
        status: this.mapRefundStatus(refund.status),
        amount: {
          value: this.convertFromSmallestUnit(
            refund.amount,
            refund.currency.toUpperCase() as Currency,
          ),
          currency: refund.currency.toUpperCase() as Currency,
        },
        createdAt: new Date(refund.created * 1000),
      };
    } catch (error: any) {
      this.logError('refund', error, { request });
      throw this.createPaymentError(
        error.message || 'Ошибка возврата платежа',
        PaymentErrorCode.REFUND_FAILED,
        this.isRetryableError(error),
        error,
      );
    }
  }

  async cancelPayment(externalPaymentId: string): Promise<PaymentStatusInfo> {
    this.logOperation('cancelPayment', { externalPaymentId });

    try {
      let paymentIntentId = externalPaymentId;

      if (paymentIntentId.startsWith('cs_')) {
        const session = await this.client.checkout.sessions.retrieve(
          paymentIntentId,
        );
        paymentIntentId = session.payment_intent as string;
      }

      const paymentIntent = await this.executeWithRetry(() =>
        this.client.paymentIntents.cancel(paymentIntentId),
      );

      return {
        id: paymentIntent.id,
        status: 'canceled',
        amount: {
          value: this.convertFromSmallestUnit(
            paymentIntent.amount,
            paymentIntent.currency.toUpperCase() as Currency,
          ),
          currency: paymentIntent.currency.toUpperCase() as Currency,
        },
        canceledAt: new Date(),
        metadata: paymentIntent.metadata as Record<string, any>,
      };
    } catch (error: any) {
      this.logError('cancelPayment', error, { externalPaymentId });
      throw this.createPaymentError(
        error.message || 'Ошибка отмены платежа',
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error,
      );
    }
  }

  async capturePayment(
    externalPaymentId: string,
    amount?: number,
  ): Promise<PaymentStatusInfo> {
    this.logOperation('capturePayment', { externalPaymentId, amount });

    try {
      let paymentIntentId = externalPaymentId;

      if (paymentIntentId.startsWith('cs_')) {
        const session = await this.client.checkout.sessions.retrieve(
          paymentIntentId,
        );
        paymentIntentId = session.payment_intent as string;
      }

      const captureParams: Stripe.PaymentIntentCaptureParams = {};

      if (amount) {
        // Получаем валюту из payment intent
        const pi = await this.client.paymentIntents.retrieve(paymentIntentId);
        captureParams.amount_to_capture = this.convertToSmallestUnit(
          amount,
          pi.currency.toUpperCase() as Currency,
        );
      }

      const paymentIntent = await this.executeWithRetry(() =>
        this.client.paymentIntents.capture(paymentIntentId, captureParams),
      );

      return {
        id: paymentIntent.id,
        status: this.mapPaymentIntentStatus(paymentIntent.status),
        amount: {
          value: this.convertFromSmallestUnit(
            paymentIntent.amount_received,
            paymentIntent.currency.toUpperCase() as Currency,
          ),
          currency: paymentIntent.currency.toUpperCase() as Currency,
        },
        paidAt: new Date(),
        metadata: paymentIntent.metadata as Record<string, any>,
      };
    } catch (error: any) {
      this.logError('capturePayment', error, { externalPaymentId, amount });
      throw this.createPaymentError(
        error.message || 'Ошибка подтверждения платежа',
        PaymentErrorCode.PROVIDER_ERROR,
        this.isRetryableError(error),
        error,
      );
    }
  }

  async parseWebhook(payload: any, signature?: string): Promise<WebhookData> {
    this.logOperation('parseWebhook', { type: payload.type });

    // Верифицируем подпись
    if (signature) {
      const isValid = await this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw this.createPaymentError(
          'Неверная подпись webhook',
          PaymentErrorCode.WEBHOOK_VERIFICATION_FAILED,
          false,
        );
      }
    }

    const event = payload as Stripe.Event;
    const object = event.data.object as any;

    let status: PaymentStatus = 'pending';
    let amount: { value: number; currency: Currency } | undefined;

    // Определяем статус в зависимости от типа события
    switch (event.type) {
      case 'checkout.session.completed':
        status = 'succeeded';
        amount = {
          value: (object.amount_total || 0) / 100,
          currency: (object.currency?.toUpperCase() || 'USD') as Currency,
        };
        break;
      case 'payment_intent.succeeded':
        status = 'succeeded';
        amount = {
          value: this.convertFromSmallestUnit(
            object.amount,
            object.currency.toUpperCase(),
          ),
          currency: object.currency.toUpperCase() as Currency,
        };
        break;
      case 'payment_intent.payment_failed':
        status = 'failed';
        break;
      case 'payment_intent.canceled':
        status = 'canceled';
        break;
      case 'charge.refunded':
        status = 'refunded';
        break;
    }

    return {
      event: event.type,
      paymentId: object.id,
      status,
      amount,
      metadata: object.metadata,
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(
    payload: any,
    signature: string,
  ): Promise<boolean> {
    try {
      // Stripe требует raw body для верификации
      const rawBody =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

      this.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret,
      );

      return true;
    } catch (error) {
      this.logError('verifyWebhookSignature', error as Error);
      return false;
    }
  }

  /**
   * Конвертация в минимальные единицы валюты
   */
  private convertToSmallestUnit(amount: number, currency: Currency): number {
    // Для большинства валют это центы/копейки (x100)
    // Для JPY и некоторых других - без конвертации
    const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND'];

    if (zeroDecimalCurrencies.includes(currency)) {
      return Math.round(amount);
    }

    return Math.round(amount * 100);
  }

  /**
   * Конвертация из минимальных единиц валюты
   */
  private convertFromSmallestUnit(amount: number, currency: Currency): number {
    const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND'];

    if (zeroDecimalCurrencies.includes(currency)) {
      return amount;
    }

    return amount / 100;
  }

  /**
   * Маппинг статуса Checkout Session
   */
  private mapSessionStatus(status: string | null): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      open: 'pending',
      complete: 'succeeded',
      expired: 'canceled',
    };

    return statusMap[status || ''] || 'pending';
  }

  /**
   * Маппинг статуса Payment Intent
   */
  private mapPaymentIntentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
      processing: 'pending',
      requires_capture: 'waiting_for_capture',
      canceled: 'canceled',
      succeeded: 'succeeded',
    };

    return statusMap[status] || 'pending';
  }

  /**
   * Маппинг статуса возврата
   */
  private mapRefundStatus(
    status: string | null,
  ): 'pending' | 'succeeded' | 'failed' {
    const statusMap: Record<string, 'pending' | 'succeeded' | 'failed'> = {
      pending: 'pending',
      succeeded: 'succeeded',
      failed: 'failed',
      canceled: 'failed',
    };

    return statusMap[status || ''] || 'pending';
  }

  /**
   * Маппинг кода ошибки Stripe
   */
  private mapStripeErrorCode(error: any): PaymentErrorCode {
    if (error.type === 'StripeAuthenticationError') {
      return PaymentErrorCode.UNAUTHORIZED;
    }
    if (error.type === 'StripeRateLimitError') {
      return PaymentErrorCode.RATE_LIMIT;
    }
    if (error.type === 'StripeCardError') {
      return PaymentErrorCode.PAYMENT_DECLINED;
    }
    if (error.code === 'resource_missing') {
      return PaymentErrorCode.PAYMENT_NOT_FOUND;
    }

    return PaymentErrorCode.PROVIDER_ERROR;
  }
}

