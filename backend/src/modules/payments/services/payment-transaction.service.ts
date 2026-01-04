import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import {
  CRYPTO_PAYMENT_CONFIRMED,
  CRYPTO_PAYMENT_EXPIRED,
  CryptoPaymentEvent,
} from "./tron-monitor.service";
import { PaymentProviderFactory } from "../providers/payment-provider.factory";
import { PaymentConfigService } from "./payment-config.service";
import {
  Payment,
  PaymentStatus,
  PaymentTargetType,
  PaymentCustomerData,
  EntityPaymentStatus,
} from "../../../database/entities/payment.entity";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";
import { Order } from "../../../database/entities/order.entity";
import { Booking } from "../../../database/entities/booking.entity";
import {
  PaymentRequest,
  PaymentResult,
  PaymentStatusInfo,
  RefundResult,
  WebhookData,
  PaymentError,
  PaymentErrorCode,
} from "../interfaces/payment-provider.interface";

/**
 * DTO для создания платежа
 */
export interface CreatePaymentDto {
  entityType: PaymentEntityType;
  entityId: string;
  targetType: PaymentTargetType;
  targetId: string;
  provider: string;
  amount: number;
  currency: string;
  description?: string;
  customer?: PaymentCustomerData;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

/**
 * События платежей
 */
export enum PaymentEvent {
  CREATED = "payment.created",
  SUCCEEDED = "payment.succeeded",
  FAILED = "payment.failed",
  CANCELED = "payment.canceled",
  REFUNDED = "payment.refunded",
}

/**
 * Сервис для управления транзакциями платежей
 *
 * Работает с новой архитектурой:
 * - Использует PaymentConfig для получения настроек
 * - Сохраняет платежи в таблицу Payment
 * - Обновляет связанные сущности (Order, Booking)
 */
@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    private readonly providerFactory: PaymentProviderFactory,
    private readonly configService: PaymentConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>
  ) {}

  /**
   * Создание платежа для сущности
   */
  async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    this.logger.log(
      `Creating payment for ${dto.entityType}:${dto.entityId}, target ${dto.targetType}:${dto.targetId}`
    );

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      dto.entityType,
      dto.entityId
    );

    if (!config.enabled) {
      throw new BadRequestException("Платежи не включены для этой сущности");
    }

    if (!config.providers.includes(dto.provider)) {
      throw new BadRequestException(
        `Провайдер ${dto.provider} не активирован`
      );
    }

    // Валидация суммы
    if (config.settings.minAmount && dto.amount < config.settings.minAmount) {
      throw new BadRequestException(
        `Сумма ${dto.amount} меньше минимальной ${config.settings.minAmount}`
      );
    }

    if (config.settings.maxAmount && dto.amount > config.settings.maxAmount) {
      throw new BadRequestException(
        `Сумма ${dto.amount} больше максимальной ${config.settings.maxAmount}`
      );
    }

    // Создаём провайдер
    const providerConfig = config.providerSettings[dto.provider];
    const provider = this.providerFactory.create(
      dto.provider as any,
      providerConfig,
      config.testMode
    );

    // Создаём платёж у провайдера
    const paymentRequest: PaymentRequest = {
      amount: {
        value: dto.amount,
        currency: dto.currency as any,
      },
      description: dto.description,
      orderId: dto.targetId,
      customer: dto.customer,
      metadata: {
        ...dto.metadata,
        entityType: dto.entityType,
        entityId: dto.entityId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
    };

    const result = await provider.createPayment(paymentRequest);

    // Сохраняем платёж в БД
    // Объединяем metadata из dto и result (для крипто-платежей важны данные из result)
    const combinedMetadata = {
      ...dto.metadata,
      ...result.metadata, // walletAddress, expectedAmount, expiresAt для крипто
    };

    const payment = this.paymentRepository.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      ownerId: config.ownerId,
      provider: dto.provider,
      externalId: result.externalId,
      status: this.mapProviderStatus(result.status),
      amount: dto.amount,
      currency: dto.currency,
      paymentUrl: result.paymentUrl,
      description: dto.description,
      customerData: dto.customer,
      metadata: combinedMetadata,
      statusHistory: [
        {
          status: PaymentStatus.PENDING,
          timestamp: new Date(),
        },
      ],
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Обновляем связанную сущность
    await this.updateTargetEntity(savedPayment);

    // Эмитим событие
    this.eventEmitter.emit(PaymentEvent.CREATED, savedPayment);

    this.logger.log(`Payment created: ${savedPayment.id}`);

    return savedPayment;
  }

  /**
   * Создание платежа для заказа
   */
  async createOrderPayment(
    shopId: string,
    orderId: string,
    provider: string,
    options?: {
      returnUrl?: string;
      cancelUrl?: string;
    }
  ): Promise<Payment> {
    // Получаем заказ
    const order = await this.orderRepository.findOne({
      where: { id: orderId, shopId },
    });

    if (!order) {
      throw new NotFoundException(`Заказ ${orderId} не найден`);
    }

    return this.createPayment({
      entityType: PaymentEntityType.SHOP,
      entityId: shopId,
      targetType: PaymentTargetType.ORDER,
      targetId: orderId,
      provider,
      amount: order.paymentAmount ?? order.totalPrice,
      currency: order.currency,
      description: `Оплата заказа #${orderId.slice(0, 8)}`,
      customer: order.customerData
        ? {
            email: order.customerData.email,
            phone: order.customerData.phone,
            fullName: `${order.customerData.firstName || ""} ${order.customerData.lastName || ""}`.trim(),
          }
        : undefined,
      metadata: {
        orderId,
        shopId,
        itemsCount: order.totalItems,
      },
      returnUrl: options?.returnUrl,
      cancelUrl: options?.cancelUrl,
    });
  }

  /**
   * Создание платежа для бронирования
   */
  async createBookingPayment(
    bookingSystemId: string,
    bookingId: string,
    provider: string,
    amount: number,
    currency: string,
    options?: {
      returnUrl?: string;
      cancelUrl?: string;
    }
  ): Promise<Payment> {
    // Получаем бронирование
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ["specialist", "service"],
    });

    if (!booking) {
      throw new NotFoundException(`Бронирование ${bookingId} не найдено`);
    }

    return this.createPayment({
      entityType: PaymentEntityType.BOOKING_SYSTEM,
      entityId: bookingSystemId,
      targetType: PaymentTargetType.BOOKING,
      targetId: bookingId,
      provider,
      amount,
      currency,
      description: `Оплата записи: ${booking.service?.name || "Услуга"}`,
      customer: {
        email: booking.clientEmail,
        phone: booking.clientPhone,
        fullName: booking.clientName,
        telegramUserId: booking.telegramUserId,
        telegramUsername: booking.telegramUsername,
      },
      metadata: {
        bookingId,
        bookingSystemId,
        serviceId: booking.serviceId,
        specialistId: booking.specialistId,
      },
      returnUrl: options?.returnUrl,
      cancelUrl: options?.cancelUrl,
    });
  }

  /**
   * Получение платежа по ID
   */
  async getPayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Платёж ${paymentId} не найден`);
    }

    return payment;
  }

  /**
   * Получение платежа по внешнему ID
   */
  async getPaymentByExternalId(externalId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { externalId },
    });
  }

  /**
   * Получение платежей для сущности
   */
  async getPaymentsByEntity(
    entityType: PaymentEntityType,
    entityId: string,
    options?: {
      status?: PaymentStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Payment[]> {
    const query = this.paymentRepository
      .createQueryBuilder("payment")
      .where("payment.entityType = :entityType", { entityType })
      .andWhere("payment.entityId = :entityId", { entityId })
      .orderBy("payment.createdAt", "DESC");

    if (options?.status) {
      query.andWhere("payment.status = :status", { status: options.status });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.getMany();
  }

  /**
   * Получение платежа для цели (Order, Booking)
   */
  async getPaymentByTarget(
    targetType: PaymentTargetType,
    targetId: string
  ): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { targetType, targetId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Обновление статуса платежа (из webhook)
   */
  async updatePaymentStatus(
    externalId: string,
    newStatus: PaymentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<Payment> {
    const payment = await this.getPaymentByExternalId(externalId);

    if (!payment) {
      throw new NotFoundException(
        `Платёж с external ID ${externalId} не найден`
      );
    }

    const oldStatus = payment.status;
    payment.updateStatus(newStatus, reason, metadata);

    const savedPayment = await this.paymentRepository.save(payment);

    // Обновляем связанную сущность
    await this.updateTargetEntity(savedPayment);

    // Эмитим событие
    const eventType = this.getEventByStatus(newStatus);
    if (eventType) {
      this.eventEmitter.emit(eventType, savedPayment, { oldStatus });
    }

    this.logger.log(
      `Payment ${payment.id} status updated: ${oldStatus} -> ${newStatus}`
    );

    return savedPayment;
  }

  /**
   * Проверка статуса платежа у провайдера
   */
  async checkPaymentStatus(paymentId: string): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      payment.entityType,
      payment.entityId
    );

    // Создаём провайдер
    const providerConfig = config.providerSettings[payment.provider];
    const provider = this.providerFactory.create(
      payment.provider as any,
      providerConfig,
      config.testMode
    );

    // Получаем статус от провайдера
    const statusInfo = await provider.getPaymentStatus(payment.externalId);
    const newStatus = this.mapProviderStatus(statusInfo.status);

    // Обновляем если статус изменился
    if (newStatus !== payment.status) {
      return this.updatePaymentStatus(payment.externalId, newStatus);
    }

    return payment;
  }

  /**
   * Возврат платежа
   */
  async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException(
        "Возврат возможен только для успешных платежей"
      );
    }

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      payment.entityType,
      payment.entityId
    );

    // Создаём провайдер
    const providerConfig = config.providerSettings[payment.provider];
    const provider = this.providerFactory.create(
      payment.provider as any,
      providerConfig,
      config.testMode
    );

    // Выполняем возврат
    const refundResult = await provider.refund({
      paymentId: payment.id,
      externalPaymentId: payment.externalId,
      amount: amount || Number(payment.amount),
      currency: payment.currency as any,
      reason,
    });

    // Добавляем информацию о возврате
    payment.addRefund({
      refundId: refundResult.id,
      externalRefundId: refundResult.id,
      amount: refundResult.amount.value,
      reason,
      status: refundResult.status,
      createdAt: refundResult.createdAt,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Обновляем связанную сущность
    await this.updateTargetEntity(savedPayment);

    // Эмитим событие
    this.eventEmitter.emit(PaymentEvent.REFUNDED, savedPayment);

    this.logger.log(`Payment ${payment.id} refunded: ${refundResult.id}`);

    return savedPayment;
  }

  /**
   * Отмена платежа
   */
  async cancelPayment(paymentId: string): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.WAITING_FOR_CAPTURE
    ) {
      throw new BadRequestException("Отмена возможна только для ожидающих платежей");
    }

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      payment.entityType,
      payment.entityId
    );

    // Создаём провайдер
    const providerConfig = config.providerSettings[payment.provider];
    const provider = this.providerFactory.create(
      payment.provider as any,
      providerConfig,
      config.testMode
    );

    // Отменяем у провайдера
    await provider.cancelPayment(payment.externalId);

    // Обновляем статус
    payment.updateStatus(PaymentStatus.CANCELED, "User canceled");

    const savedPayment = await this.paymentRepository.save(payment);

    // Обновляем связанную сущность
    await this.updateTargetEntity(savedPayment);

    // Эмитим событие
    this.eventEmitter.emit(PaymentEvent.CANCELED, savedPayment);

    this.logger.log(`Payment ${payment.id} canceled`);

    return savedPayment;
  }

  /**
   * Обработка webhook
   */
  async handleWebhook(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string,
    payload: any,
    signature?: string
  ): Promise<Payment | null> {
    this.logger.log(
      `Processing webhook for ${entityType}:${entityId}, provider ${provider}`
    );

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      entityType,
      entityId
    );

    // Создаём провайдер
    const providerConfig = config.providerSettings[provider];
    const paymentProvider = this.providerFactory.create(
      provider as any,
      providerConfig,
      config.testMode
    );

    // Парсим webhook
    const webhookData = await paymentProvider.parseWebhook(payload, signature);

    // Находим платёж
    const payment = await this.getPaymentByExternalId(webhookData.paymentId);

    if (!payment) {
      this.logger.warn(`Payment not found for webhook: ${webhookData.paymentId}`);
      return null;
    }

    // Обновляем статус
    const newStatus = this.mapProviderStatus(webhookData.status);
    if (newStatus !== payment.status) {
      return this.updatePaymentStatus(
        payment.externalId,
        newStatus,
        webhookData.event,
        webhookData.metadata
      );
    }

    return payment;
  }

  // ============================================
  // Приватные методы
  // ============================================

  /**
   * Обновление связанной сущности (Order, Booking)
   */
  private async updateTargetEntity(payment: Payment): Promise<void> {
    const entityStatus = payment.toEntityPaymentStatus();

    switch (payment.targetType) {
      case PaymentTargetType.ORDER:
        await this.orderRepository.update(payment.targetId, {
          paymentId: payment.id,
          paymentStatus: entityStatus,
        });
        break;

      case PaymentTargetType.BOOKING:
        await this.bookingRepository.update(payment.targetId, {
          paymentId: payment.id,
          paymentStatus: entityStatus,
        });
        break;
    }
  }

  /**
   * Маппинг статуса провайдера в наш статус
   */
  private mapProviderStatus(providerStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      waiting_for_capture: PaymentStatus.WAITING_FOR_CAPTURE,
      succeeded: PaymentStatus.SUCCEEDED,
      canceled: PaymentStatus.CANCELED,
      refunded: PaymentStatus.REFUNDED,
      failed: PaymentStatus.FAILED,
    };

    return statusMap[providerStatus] || PaymentStatus.PENDING;
  }

  /**
   * Получение события по статусу
   */
  private getEventByStatus(status: PaymentStatus): PaymentEvent | null {
    const eventMap: Record<PaymentStatus, PaymentEvent | null> = {
      [PaymentStatus.PENDING]: null,
      [PaymentStatus.WAITING_FOR_CAPTURE]: null,
      [PaymentStatus.SUCCEEDED]: PaymentEvent.SUCCEEDED,
      [PaymentStatus.CANCELED]: PaymentEvent.CANCELED,
      [PaymentStatus.REFUNDED]: PaymentEvent.REFUNDED,
      [PaymentStatus.PARTIALLY_REFUNDED]: PaymentEvent.REFUNDED,
      [PaymentStatus.FAILED]: PaymentEvent.FAILED,
    };

    return eventMap[status];
  }

  // =====================================================
  // Обработчики событий криптоплатежей
  // =====================================================

  /**
   * Обработка подтверждённого крипто-платежа
   */
  @OnEvent(CRYPTO_PAYMENT_CONFIRMED)
  async handleCryptoPaymentConfirmed(event: CryptoPaymentEvent): Promise<void> {
    this.logger.log(
      `Handling confirmed crypto payment: ${event.payment.id}, tx: ${event.payment.transactionId}`
    );

    try {
      // Ищем платёж в БД по externalId (который совпадает с id крипто-платежа)
      const payment = await this.paymentRepository.findOne({
        where: { externalId: event.payment.id },
      });

      if (!payment) {
        this.logger.warn(
          `Payment not found in DB for crypto payment ${event.payment.id}`
        );
        return;
      }

      // Обновляем статус
      payment.updateStatus(
        PaymentStatus.SUCCEEDED,
        "Crypto payment confirmed",
        {
          transactionId: event.payment.transactionId,
          confirmedAt: event.payment.paidAt?.toISOString(),
        }
      );

      const savedPayment = await this.paymentRepository.save(payment);

      // Обновляем связанную сущность
      await this.updateTargetEntity(savedPayment);

      // Эмитим событие
      this.eventEmitter.emit(PaymentEvent.SUCCEEDED, savedPayment);

      this.logger.log(`Crypto payment ${payment.id} confirmed successfully`);
    } catch (error: any) {
      this.logger.error(
        `Error handling crypto payment confirmation: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Обработка истёкшего крипто-платежа
   */
  @OnEvent(CRYPTO_PAYMENT_EXPIRED)
  async handleCryptoPaymentExpired(event: CryptoPaymentEvent): Promise<void> {
    this.logger.log(`Handling expired crypto payment: ${event.payment.id}`);

    try {
      // Ищем платёж в БД
      const payment = await this.paymentRepository.findOne({
        where: { externalId: event.payment.id },
      });

      if (!payment) {
        this.logger.warn(
          `Payment not found in DB for expired crypto payment ${event.payment.id}`
        );
        return;
      }

      // Обновляем статус только если платёж ещё pending
      if (payment.status === PaymentStatus.PENDING) {
        payment.updateStatus(PaymentStatus.CANCELED, "Payment expired");

        const savedPayment = await this.paymentRepository.save(payment);

        // Обновляем связанную сущность
        await this.updateTargetEntity(savedPayment);

        // Эмитим событие
        this.eventEmitter.emit(PaymentEvent.CANCELED, savedPayment);

        this.logger.log(`Crypto payment ${payment.id} marked as expired`);
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling crypto payment expiration: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Получить все pending крипто-платежи из БД
   * Используется TronMonitorService для проверки транзакций
   */
  async getPendingCryptoPayments(): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: {
        provider: "crypto_trc20",
        status: PaymentStatus.PENDING,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }
}

