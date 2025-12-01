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
  CryptoTRC20Config,
  CryptoTRC20ConfigSchema,
  PaymentStatus,
  Currency,
} from "../schemas/payment.schemas";

// Контрактный адрес USDT TRC-20
const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
// Testnet (Nile) USDT контракт
const USDT_TESTNET_CONTRACT_ADDRESS = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";

// Интерфейсы для TronGrid API
interface TRC20Transaction {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
  };
}

interface TRC20TransactionsResponse {
  data: TRC20Transaction[];
  success: boolean;
  meta: {
    at: number;
    page_size: number;
  };
}

// Интерфейс для хранения ожидающих платежей
export interface PendingCryptoPayment {
  id: string;
  expectedAmount: number; // Уникальная сумма USDT с копейками
  originalAmount: number; // Исходная сумма в фиате
  originalCurrency: string; // Исходная валюта (RUB, USD, EUR, GBP)
  exchangeRate: number; // Курс конвертации на момент создания
  walletAddress: string;
  createdAt: Date;
  expiresAt: Date;
  status: PaymentStatus;
  metadata?: Record<string, any>;
  transactionId?: string;
  paidAt?: Date;
}

/**
 * Провайдер для оплаты криптовалютой USDT (TRC-20)
 * Использует TronGrid API для мониторинга входящих транзакций
 */
export class CryptoTRC20Provider extends BasePaymentProvider {
  private config: CryptoTRC20Config;
  private readonly baseUrl: string;
  private readonly contractAddress: string;

  // Хранилище ожидающих платежей (в production лучше использовать Redis)
  private static pendingPayments: Map<string, PendingCryptoPayment> = new Map();

  constructor(config: CryptoTRC20Config, testMode: boolean = false) {
    super("crypto_trc20", testMode);
    this.config = config;

    // Выбираем API URL и контракт в зависимости от режима
    if (testMode || config.useTestnet) {
      this.baseUrl = "https://nile.trongrid.io";
      this.contractAddress = USDT_TESTNET_CONTRACT_ADDRESS;
    } else {
      this.baseUrl = "https://api.trongrid.io";
      this.contractAddress = USDT_CONTRACT_ADDRESS;
    }
  }

  get info(): ProviderInfo {
    return {
      name: "USDT TRC-20",
      type: "crypto_trc20",
      // Поддерживаем фиатные валюты - они конвертируются в USDT
      supportedCurrencies: ["RUB", "USD", "EUR", "GBP"],
      supportedMethods: ["crypto"],
      testMode: this.testMode,
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    try {
      const result = CryptoTRC20ConfigSchema.safeParse(this.config);

      if (!result.success) {
        return {
          valid: false,
          errors: result.error.issues.map((e) => e.message),
        };
      }

      // Проверяем доступность TronGrid API
      try {
        const response = await fetch(
          `${this.baseUrl}/v1/accounts/${this.config.walletAddress}`,
          {
            headers: this.getApiHeaders(),
          }
        );

        if (!response.ok) {
          return {
            valid: false,
            errors: ["Не удалось проверить адрес кошелька в сети TRON"],
          };
        }

        const data = await response.json();
        if (!data.success && !data.data) {
          return {
            valid: false,
            errors: ["Адрес кошелька не найден в сети TRON"],
          };
        }
      } catch (error: any) {
        this.logError("validateConfig", error);
        return {
          valid: false,
          errors: ["Ошибка соединения с TronGrid API"],
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

  /**
   * Создание платежа с уникальной суммой
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    this.logOperation("createPayment", {
      amount: request.amount,
      orderId: request.orderId,
    });

    try {
      // Генерируем уникальную сумму с "копейками"
      const uniqueAmount = this.generateUniqueAmount(request.amount.value);
      const paymentId = this.generatePaymentId();

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.config.expirationMinutes * 60 * 1000
      );

      // Создаём запись о платеже
      const pendingPayment: PendingCryptoPayment = {
        id: paymentId,
        expectedAmount: uniqueAmount,
        originalAmount: request.amount.value,
        originalCurrency: request.amount.currency,
        exchangeRate:
          request.amount.value > 0 ? uniqueAmount / request.amount.value : 1,
        walletAddress: this.config.walletAddress,
        createdAt: now,
        expiresAt,
        status: "pending",
        metadata: {
          ...request.metadata,
          orderId: request.orderId,
        },
      };

      // Сохраняем в Map (в production - в Redis/DB)
      CryptoTRC20Provider.pendingPayments.set(paymentId, pendingPayment);

      return {
        id: paymentId,
        externalId: paymentId,
        status: "pending",
        amount: {
          value: uniqueAmount,
          currency: "USDT" as Currency,
        },
        // Для крипто-платежей paymentUrl содержит данные для отображения
        paymentUrl: this.buildPaymentDataUrl(pendingPayment),
        createdAt: now,
        metadata: {
          ...request.metadata,
          walletAddress: this.config.walletAddress,
          expectedAmount: uniqueAmount,
          expiresAt: expiresAt.toISOString(),
          network: "TRC-20",
          currency: "USDT",
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

  /**
   * Получение статуса платежа
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusInfo> {
    this.logOperation("getPaymentStatus", { paymentId });

    const payment = CryptoTRC20Provider.pendingPayments.get(paymentId);

    if (!payment) {
      throw this.createPaymentError(
        "Платеж не найден",
        PaymentErrorCode.PAYMENT_NOT_FOUND,
        false
      );
    }

    // Проверяем, не истёк ли платёж
    if (payment.status === "pending" && new Date() > payment.expiresAt) {
      payment.status = "canceled";
      CryptoTRC20Provider.pendingPayments.set(paymentId, payment);
    }

    return {
      id: payment.id,
      status: payment.status,
      amount: {
        value: payment.expectedAmount,
        currency: "USDT" as Currency,
      },
      paidAt: payment.paidAt,
      canceledAt: payment.status === "canceled" ? payment.expiresAt : undefined,
      metadata: payment.metadata,
    };
  }

  /**
   * Проверка входящих транзакций для всех ожидающих платежей
   */
  async checkPendingPayments(): Promise<PendingCryptoPayment[]> {
    const confirmedPayments: PendingCryptoPayment[] = [];
    const now = new Date();

    for (const [paymentId, payment] of CryptoTRC20Provider.pendingPayments) {
      if (payment.status !== "pending") continue;

      // Проверяем истечение срока
      if (now > payment.expiresAt) {
        payment.status = "canceled";
        CryptoTRC20Provider.pendingPayments.set(paymentId, payment);
        continue;
      }

      // Проверяем транзакции
      try {
        const transaction = await this.findMatchingTransaction(payment);

        if (transaction) {
          payment.status = "succeeded";
          payment.transactionId = transaction.transaction_id;
          payment.paidAt = new Date(transaction.block_timestamp);
          CryptoTRC20Provider.pendingPayments.set(paymentId, payment);
          confirmedPayments.push(payment);

          this.logOperation("paymentConfirmed", {
            paymentId,
            transactionId: transaction.transaction_id,
          });
        }
      } catch (error: any) {
        this.logError("checkPendingPayments", error, { paymentId });
      }
    }

    return confirmedPayments;
  }

  /**
   * Поиск подходящей транзакции для платежа
   */
  private async findMatchingTransaction(
    payment: PendingCryptoPayment
  ): Promise<TRC20Transaction | null> {
    try {
      const url = `${this.baseUrl}/v1/accounts/${payment.walletAddress}/transactions/trc20`;
      const params = new URLSearchParams({
        only_to: "true",
        only_confirmed: "true",
        limit: "50",
        contract_address: this.contractAddress,
        min_timestamp: payment.createdAt.getTime().toString(),
      });

      const response = await fetch(`${url}?${params}`, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(`TronGrid API error: ${response.status}`);
      }

      const data: TRC20TransactionsResponse = await response.json();

      if (!data.success || !data.data) {
        return null;
      }

      // Ищем транзакцию с подходящей суммой
      for (const tx of data.data) {
        // Конвертируем сумму из наименьших единиц (6 decimals для USDT)
        const txAmount = parseFloat(tx.value) / 1_000_000;

        // Проверяем совпадение суммы с допуском
        if (this.isAmountMatch(payment.expectedAmount, txAmount)) {
          return tx;
        }
      }

      return null;
    } catch (error: any) {
      this.logError("findMatchingTransaction", error);
      return null;
    }
  }

  /**
   * Проверка совпадения суммы с допуском
   */
  private isAmountMatch(expected: number, actual: number): boolean {
    const tolerance = expected * (this.config.amountTolerancePercent / 100);
    return Math.abs(expected - actual) <= tolerance;
  }

  /**
   * Генерация уникальной суммы с "копейками"
   */
  private generateUniqueAmount(baseAmount: number): number {
    // Генерируем случайные 4 цифры после запятой (0.0001 - 0.9999)
    const randomCents = Math.floor(Math.random() * 9999) + 1;
    const uniquePart = randomCents / 10000;

    // Для сумм < 10 добавляем меньше копеек
    if (baseAmount < 10) {
      return parseFloat((baseAmount + uniquePart / 10).toFixed(4));
    }

    return parseFloat((baseAmount + uniquePart).toFixed(4));
  }

  /**
   * Генерация ID платежа
   */
  private generatePaymentId(): string {
    return `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Получение заголовков для API запросов
   */
  private getApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.config.tronGridApiKey) {
      headers["TRON-PRO-API-KEY"] = this.config.tronGridApiKey;
    }

    return headers;
  }

  /**
   * Построение URL с данными платежа (для отображения на фронте)
   */
  private buildPaymentDataUrl(payment: PendingCryptoPayment): string {
    const paymentData = {
      type: "crypto_trc20",
      address: payment.walletAddress,
      amount: payment.expectedAmount,
      currency: "USDT",
      network: "TRC-20",
      paymentId: payment.id,
      expiresAt: payment.expiresAt.toISOString(),
    };

    // Кодируем данные в base64 для передачи
    return `crypto://${Buffer.from(JSON.stringify(paymentData)).toString("base64")}`;
  }

  /**
   * Получение всех ожидающих платежей (для мониторинга)
   */
  static getPendingPayments(): PendingCryptoPayment[] {
    return Array.from(CryptoTRC20Provider.pendingPayments.values()).filter(
      (p) => p.status === "pending"
    );
  }

  /**
   * Получение платежа по ID
   */
  static getPayment(paymentId: string): PendingCryptoPayment | undefined {
    return CryptoTRC20Provider.pendingPayments.get(paymentId);
  }

  // === Методы, не применимые для крипто-платежей ===

  async refund(_request: RefundRequest): Promise<RefundResult> {
    throw this.createPaymentError(
      "Возврат криптовалютных платежей не поддерживается автоматически",
      PaymentErrorCode.REFUND_FAILED,
      false
    );
  }

  async cancelPayment(paymentId: string): Promise<PaymentStatusInfo> {
    const payment = CryptoTRC20Provider.pendingPayments.get(paymentId);

    if (!payment) {
      throw this.createPaymentError(
        "Платеж не найден",
        PaymentErrorCode.PAYMENT_NOT_FOUND,
        false
      );
    }

    if (payment.status !== "pending") {
      throw this.createPaymentError(
        "Невозможно отменить платеж в текущем статусе",
        PaymentErrorCode.PROVIDER_ERROR,
        false
      );
    }

    payment.status = "canceled";
    CryptoTRC20Provider.pendingPayments.set(paymentId, payment);

    return {
      id: payment.id,
      status: "canceled",
      amount: {
        value: payment.expectedAmount,
        currency: "USDT" as Currency,
      },
      canceledAt: new Date(),
      metadata: payment.metadata,
    };
  }

  async capturePayment(paymentId: string): Promise<PaymentStatusInfo> {
    // Крипто-платежи автоматически подтверждаются при обнаружении транзакции
    return this.getPaymentStatus(paymentId);
  }

  async parseWebhook(_payload: any, _signature?: string): Promise<WebhookData> {
    // Крипто-платежи не используют webhook'и, мониторинг идёт через polling
    throw this.createPaymentError(
      "Webhook не поддерживается для криптовалютных платежей",
      PaymentErrorCode.PROVIDER_ERROR,
      false
    );
  }

  async verifyWebhookSignature(
    _payload: any,
    _signature: string
  ): Promise<boolean> {
    return false;
  }
}
