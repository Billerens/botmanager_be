import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  CryptoTRC20Provider,
  PendingCryptoPayment,
} from "../providers/crypto-trc20.provider";

// События для уведомления о статусе платежей
export const CRYPTO_PAYMENT_CONFIRMED = "crypto.payment.confirmed";
export const CRYPTO_PAYMENT_EXPIRED = "crypto.payment.expired";

export interface CryptoPaymentEvent {
  payment: PendingCryptoPayment;
  botId?: string;
  module?: string;
}

/**
 * Сервис мониторинга криптовалютных платежей
 * Запускает фоновую проверку входящих транзакций USDT TRC-20
 */
@Injectable()
export class TronMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TronMonitorService.name);
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Интервал проверки в миллисекундах (по умолчанию 30 секунд)
  private readonly CHECK_INTERVAL_MS = 30_000;

  // Кэш провайдеров для мониторинга (botId -> provider)
  private providers: Map<string, CryptoTRC20Provider> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.startMonitoring();
  }

  onModuleDestroy() {
    this.stopMonitoring();
  }

  /**
   * Запуск мониторинга
   */
  startMonitoring(): void {
    if (this.isRunning) {
      this.logger.warn("Tron monitor is already running");
      return;
    }

    this.isRunning = true;
    this.logger.log("Starting Tron payment monitor...");

    this.monitorInterval = setInterval(async () => {
      await this.checkAllPendingPayments();
    }, this.CHECK_INTERVAL_MS);

    // Сразу запускаем первую проверку
    this.checkAllPendingPayments();
  }

  /**
   * Остановка мониторинга
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    this.logger.log("Tron payment monitor stopped");
  }

  /**
   * Регистрация провайдера для мониторинга
   */
  registerProvider(botId: string, provider: CryptoTRC20Provider): void {
    this.providers.set(botId, provider);
    this.logger.log(`Registered crypto provider for bot ${botId}`);
  }

  /**
   * Удаление провайдера из мониторинга
   */
  unregisterProvider(botId: string): void {
    this.providers.delete(botId);
    this.logger.log(`Unregistered crypto provider for bot ${botId}`);
  }

  /**
   * Проверка всех ожидающих платежей
   */
  private async checkAllPendingPayments(): Promise<void> {
    const pendingPayments = CryptoTRC20Provider.getPendingPayments();

    if (pendingPayments.length === 0) {
      return;
    }

    this.logger.debug(
      `Checking ${pendingPayments.length} pending crypto payments...`
    );

    // Группируем платежи по адресам кошельков для оптимизации запросов
    const paymentsByWallet = this.groupPaymentsByWallet(pendingPayments);

    for (const [walletAddress, payments] of paymentsByWallet) {
      try {
        await this.checkWalletPayments(walletAddress, payments);
      } catch (error: any) {
        this.logger.error(
          `Error checking payments for wallet ${walletAddress}: ${error.message}`
        );
      }
    }
  }

  /**
   * Группировка платежей по адресам кошельков
   */
  private groupPaymentsByWallet(
    payments: PendingCryptoPayment[]
  ): Map<string, PendingCryptoPayment[]> {
    const grouped = new Map<string, PendingCryptoPayment[]>();

    for (const payment of payments) {
      const wallet = payment.walletAddress;
      if (!grouped.has(wallet)) {
        grouped.set(wallet, []);
      }
      grouped.get(wallet)!.push(payment);
    }

    return grouped;
  }

  /**
   * Проверка платежей для конкретного кошелька
   */
  private async checkWalletPayments(
    walletAddress: string,
    payments: PendingCryptoPayment[]
  ): Promise<void> {
    // Находим провайдер для этого кошелька
    let provider: CryptoTRC20Provider | undefined;

    for (const p of this.providers.values()) {
      // Проверяем через публичный метод или напрямую
      const pendingPayment = CryptoTRC20Provider.getPayment(payments[0].id);
      if (pendingPayment) {
        provider = p;
        break;
      }
    }

    if (!provider) {
      // Создаём временный провайдер для проверки
      // В реальном приложении лучше хранить конфигурацию в БД
      this.logger.warn(
        `No registered provider found for wallet ${walletAddress}, skipping...`
      );
      return;
    }

    // Проверяем платежи
    const confirmedPayments = await provider.checkPendingPayments();

    // Эмитим события для подтверждённых платежей
    for (const payment of confirmedPayments) {
      this.logger.log(`Payment confirmed: ${payment.id}`);

      this.eventEmitter.emit(CRYPTO_PAYMENT_CONFIRMED, {
        payment,
        botId: payment.metadata?.botId,
        module: payment.metadata?.module,
      } as CryptoPaymentEvent);
    }

    // Проверяем истёкшие платежи
    const now = new Date();
    for (const payment of payments) {
      if (payment.status === "pending" && now > payment.expiresAt) {
        this.logger.log(`Payment expired: ${payment.id}`);

        this.eventEmitter.emit(CRYPTO_PAYMENT_EXPIRED, {
          payment,
          botId: payment.metadata?.botId,
          module: payment.metadata?.module,
        } as CryptoPaymentEvent);
      }
    }
  }

  /**
   * Принудительная проверка конкретного платежа
   */
  async checkPayment(paymentId: string): Promise<PendingCryptoPayment | null> {
    const payment = CryptoTRC20Provider.getPayment(paymentId);

    if (!payment) {
      return null;
    }

    // Находим провайдер и проверяем
    for (const provider of this.providers.values()) {
      try {
        const confirmed = await provider.checkPendingPayments();
        const confirmedPayment = confirmed.find((p) => p.id === paymentId);

        if (confirmedPayment) {
          this.eventEmitter.emit(CRYPTO_PAYMENT_CONFIRMED, {
            payment: confirmedPayment,
            botId: confirmedPayment.metadata?.botId,
            module: confirmedPayment.metadata?.module,
          } as CryptoPaymentEvent);

          return confirmedPayment;
        }
      } catch (error: any) {
        this.logger.error(
          `Error checking payment ${paymentId}: ${error.message}`
        );
      }
    }

    return CryptoTRC20Provider.getPayment(paymentId) || null;
  }

  /**
   * Получение статистики мониторинга
   */
  getStats(): {
    isRunning: boolean;
    pendingPaymentsCount: number;
    registeredProvidersCount: number;
  } {
    return {
      isRunning: this.isRunning,
      pendingPaymentsCount: CryptoTRC20Provider.getPendingPayments().length,
      registeredProvidersCount: this.providers.size,
    };
  }
}
