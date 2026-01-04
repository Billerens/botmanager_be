import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  CryptoTRC20Provider,
  PendingCryptoPayment,
} from "../providers/crypto-trc20.provider";
import {
  Payment,
  PaymentStatus,
} from "../../../database/entities/payment.entity";
import { PaymentConfigService } from "./payment-config.service";
import { PaymentProviderFactory } from "../providers/payment-provider.factory";

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
 * Теперь читает pending платежи из БД вместо in-memory Map
 */
@Injectable()
export class TronMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TronMonitorService.name);
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Интервал проверки в миллисекундах (по умолчанию 30 секунд)
  private readonly CHECK_INTERVAL_MS = 30_000;

  // Кэш провайдеров для мониторинга (entityId -> provider)
  private providers: Map<string, CryptoTRC20Provider> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly configService: PaymentConfigService,
    private readonly providerFactory: PaymentProviderFactory
  ) {}

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
   * Проверка всех ожидающих платежей из БД
   */
  private async checkAllPendingPayments(): Promise<void> {
    try {
      // Получаем pending крипто-платежи из БД
      const pendingPayments = await this.paymentRepository.find({
        where: {
          provider: "crypto_trc20",
          status: PaymentStatus.PENDING,
        },
        order: {
          createdAt: "ASC",
        },
      });

      if (pendingPayments.length === 0) {
        return;
      }

      this.logger.debug(
        `Checking ${pendingPayments.length} pending crypto payments from DB...`
      );

      // Группируем платежи по entityType:entityId для получения провайдера
      const paymentsByEntity = this.groupPaymentsByEntity(pendingPayments);

      for (const [entityKey, payments] of paymentsByEntity) {
        try {
          await this.checkEntityPayments(entityKey, payments);
        } catch (error: any) {
          this.logger.error(
            `Error checking payments for entity ${entityKey}: ${error.message}`
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in checkAllPendingPayments: ${error.message}`);
    }
  }

  /**
   * Группировка платежей по сущности
   */
  private groupPaymentsByEntity(payments: Payment[]): Map<string, Payment[]> {
    const grouped = new Map<string, Payment[]>();

    for (const payment of payments) {
      const key = `${payment.entityType}:${payment.entityId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    }

    return grouped;
  }

  /**
   * Проверка платежей для конкретной сущности
   */
  private async checkEntityPayments(
    entityKey: string,
    payments: Payment[]
  ): Promise<void> {
    const [entityType, entityId] = entityKey.split(":");

    try {
      // Получаем конфигурацию платежей для сущности
      const config = await this.configService.getConfigInternal(
        entityType as any,
        entityId
      );

      if (!config || !config.providerSettings?.crypto_trc20) {
        this.logger.warn(`No crypto_trc20 config for ${entityKey}`);
        return;
      }

      // Создаём провайдер
      const provider = this.providerFactory.create(
        "crypto_trc20",
        config.providerSettings.crypto_trc20,
        config.testMode
      ) as CryptoTRC20Provider;

      // Проверяем каждый платёж
      for (const payment of payments) {
        await this.checkSinglePayment(payment, provider);
      }
    } catch (error: any) {
      this.logger.error(
        `Error getting config for ${entityKey}: ${error.message}`
      );
    }
  }

  /**
   * Проверка одного платежа
   */
  private async checkSinglePayment(
    payment: Payment,
    provider: CryptoTRC20Provider
  ): Promise<void> {
    try {
      // Проверяем время жизни платежа (по умолчанию 30 минут)
      const expirationMinutes = payment.metadata?.expirationMinutes || 30;
      const expiresAt = new Date(
        payment.createdAt.getTime() + expirationMinutes * 60 * 1000
      );
      const now = new Date();

      // Если платёж истёк
      if (now > expiresAt) {
        this.logger.log(`Payment ${payment.id} expired`);

        const pendingPayment: PendingCryptoPayment = {
          id: payment.externalId,
          expectedAmount: payment.metadata?.expectedAmount || payment.amount,
          originalAmount: payment.amount,
          originalCurrency: payment.currency,
          exchangeRate: 1,
          walletAddress: payment.metadata?.walletAddress || "",
          createdAt: payment.createdAt,
          expiresAt,
          status: "canceled",
          metadata: payment.metadata,
        };

        this.eventEmitter.emit(CRYPTO_PAYMENT_EXPIRED, {
          payment: pendingPayment,
        } as CryptoPaymentEvent);

        return;
      }

      // Создаём объект PendingCryptoPayment для проверки
      const pendingPayment: PendingCryptoPayment = {
        id: payment.externalId,
        expectedAmount: payment.metadata?.expectedAmount || payment.amount,
        originalAmount: payment.amount,
        originalCurrency: payment.currency,
        exchangeRate: payment.metadata?.exchangeRate || 1,
        walletAddress: payment.metadata?.walletAddress || "",
        createdAt: payment.createdAt,
        expiresAt,
        status: "pending",
        metadata: {
          ...payment.metadata,
          paymentDbId: payment.id,
        },
      };

      // Проверяем входящие транзакции для этого платежа
      const transaction = await provider.findMatchingTransactionPublic(
        pendingPayment
      );

      if (transaction) {
        this.logger.log(
          `Found matching transaction for payment ${payment.id}: ${transaction.transaction_id}`
        );

        // Обновляем объект
        pendingPayment.status = "succeeded";
        pendingPayment.transactionId = transaction.transaction_id;
        pendingPayment.paidAt = new Date(transaction.block_timestamp);

        // Эмитим событие
        this.eventEmitter.emit(CRYPTO_PAYMENT_CONFIRMED, {
          payment: pendingPayment,
        } as CryptoPaymentEvent);
      }
    } catch (error: any) {
      this.logger.error(
        `Error checking payment ${payment.id}: ${error.message}`
      );
    }
  }

  /**
   * Принудительная проверка конкретного платежа по ID в БД
   */
  async checkPaymentById(paymentId: string): Promise<boolean> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId, provider: "crypto_trc20" },
      });

      if (!payment || payment.status !== PaymentStatus.PENDING) {
        return false;
      }

      // Получаем конфигурацию
      const config = await this.configService.getConfigInternal(
        payment.entityType,
        payment.entityId
      );

      if (!config?.providerSettings?.crypto_trc20) {
        return false;
      }

      const provider = this.providerFactory.create(
        "crypto_trc20",
        config.providerSettings.crypto_trc20,
        config.testMode
      ) as CryptoTRC20Provider;

      await this.checkSinglePayment(payment, provider);

      return true;
    } catch (error: any) {
      this.logger.error(`Error checking payment ${paymentId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Получение статистики мониторинга
   */
  async getStats(): Promise<{
    isRunning: boolean;
    pendingPaymentsCount: number;
  }> {
    const count = await this.paymentRepository.count({
      where: {
        provider: "crypto_trc20",
        status: PaymentStatus.PENDING,
      },
    });

    return {
      isRunning: this.isRunning,
      pendingPaymentsCount: count,
    };
  }
}
