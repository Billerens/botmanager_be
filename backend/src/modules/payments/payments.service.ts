import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentProviderFactory } from "./providers/payment-provider.factory";
import {
  IPaymentProvider,
  PaymentRequest,
  PaymentResult,
  PaymentStatusInfo,
  RefundResult,
  WebhookData,
  PaymentError,
  PaymentErrorCode,
} from "./interfaces/payment-provider.interface";
import {
  PaymentProvider,
  PaymentSettings,
  ModuleConfig,
  CreatePaymentRequest,
  CreatePaymentRequestSchema,
  PaymentSettingsSchema,
} from "./schemas/payment.schemas";
import { Bot } from "../../database/entities/bot.entity";

/**
 * Сервис управления платежами
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providerCache = new Map<string, IPaymentProvider>();

  constructor(
    private readonly providerFactory: PaymentProviderFactory,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>
  ) {}

  /**
   * Создание платежа
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    this.logger.log(`Creating payment for bot ${request.botId}`);

    // Валидируем запрос
    const validatedRequest = CreatePaymentRequestSchema.parse(request);

    // Получаем настройки платежей для бота
    const settings = await this.getPaymentSettings(validatedRequest.botId);

    // Проверяем, включены ли платежи
    if (!settings.global.enabled) {
      throw new PaymentError(
        "Платежи отключены для этого бота",
        PaymentErrorCode.INVALID_CONFIG,
        validatedRequest.provider,
        false
      );
    }

    // Получаем конфигурацию модуля
    const moduleConfig = settings.modules[validatedRequest.module];
    if (!moduleConfig.settings.enabled) {
      throw new PaymentError(
        `Модуль ${validatedRequest.module} отключен`,
        PaymentErrorCode.INVALID_CONFIG,
        validatedRequest.provider,
        false
      );
    }

    // Проверяем, что провайдер активирован для модуля
    if (!moduleConfig.providers.includes(validatedRequest.provider)) {
      throw new PaymentError(
        `Провайдер ${validatedRequest.provider} не активирован для модуля ${validatedRequest.module}`,
        PaymentErrorCode.INVALID_CONFIG,
        validatedRequest.provider,
        false
      );
    }

    // Валидируем сумму
    this.validateAmount(
      validatedRequest.amount.value,
      moduleConfig.settings.minAmount,
      moduleConfig.settings.maxAmount
    );

    // Получаем провайдер
    const provider = await this.getProvider(
      validatedRequest.botId,
      validatedRequest.module,
      validatedRequest.provider,
      settings.global.testMode
    );

    // Создаем платеж
    const paymentRequest: PaymentRequest = {
      amount: validatedRequest.amount,
      description: validatedRequest.description,
      orderId: validatedRequest.orderId,
      customer: validatedRequest.customer,
      metadata: {
        ...validatedRequest.metadata,
        botId: validatedRequest.botId,
        module: validatedRequest.module,
      },
      returnUrl: validatedRequest.returnUrl,
      cancelUrl: validatedRequest.cancelUrl,
    };

    const result = await provider.createPayment(paymentRequest);

    // TODO: Сохранить платеж в БД

    this.logger.log(
      `Payment created: ${result.id} for bot ${validatedRequest.botId}`
    );

    return result;
  }

  /**
   * Получение статуса платежа
   */
  async getPaymentStatus(
    botId: string,
    module: "shop" | "booking" | "api",
    provider: PaymentProvider,
    externalPaymentId: string
  ): Promise<PaymentStatusInfo> {
    this.logger.log(`Getting payment status: ${externalPaymentId}`);

    const settings = await this.getPaymentSettings(botId);
    const paymentProvider = await this.getProvider(
      botId,
      module,
      provider,
      settings.global.testMode
    );

    return paymentProvider.getPaymentStatus(externalPaymentId);
  }

  /**
   * Возврат платежа
   */
  async refundPayment(
    botId: string,
    module: "shop" | "booking" | "api",
    provider: PaymentProvider,
    paymentId: string,
    externalPaymentId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    this.logger.log(`Refunding payment: ${paymentId}`);

    const settings = await this.getPaymentSettings(botId);
    const paymentProvider = await this.getProvider(
      botId,
      module,
      provider,
      settings.global.testMode
    );

    return paymentProvider.refund({
      paymentId,
      externalPaymentId,
      amount,
      reason,
    });
  }

  /**
   * Отмена платежа
   */
  async cancelPayment(
    botId: string,
    module: "shop" | "booking" | "api",
    provider: PaymentProvider,
    externalPaymentId: string
  ): Promise<PaymentStatusInfo> {
    this.logger.log(`Canceling payment: ${externalPaymentId}`);

    const settings = await this.getPaymentSettings(botId);
    const paymentProvider = await this.getProvider(
      botId,
      module,
      provider,
      settings.global.testMode
    );

    return paymentProvider.cancelPayment(externalPaymentId);
  }

  /**
   * Обработка webhook
   */
  async handleWebhook(
    botId: string,
    provider: PaymentProvider,
    payload: any,
    signature?: string
  ): Promise<WebhookData> {
    this.logger.log(
      `Processing webhook for bot ${botId}, provider ${provider}`
    );

    const settings = await this.getPaymentSettings(botId);

    // Определяем модуль из metadata
    const module = payload.metadata?.module || "shop";

    const paymentProvider = await this.getProvider(
      botId,
      module,
      provider,
      settings.global.testMode
    );

    const webhookData = await paymentProvider.parseWebhook(payload, signature);

    // TODO: Обновить статус платежа в БД
    // TODO: Отправить уведомление пользователю

    this.logger.log(
      `Webhook processed: ${webhookData.event} for payment ${webhookData.paymentId}`
    );

    return webhookData;
  }

  /**
   * Получение настроек платежей для бота
   */
  async getPaymentSettings(botId: string): Promise<PaymentSettings> {
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException(`Бот ${botId} не найден`);
    }

    // Получаем настройки из customData бота
    const customData = (bot as any).customData || {};
    const paymentSettings = customData.paymentSettings;

    if (!paymentSettings) {
      // Возвращаем дефолтные настройки
      return this.getDefaultSettings(botId);
    }

    // Валидируем настройки
    const result = PaymentSettingsSchema.safeParse(paymentSettings);
    if (!result.success) {
      this.logger.warn(
        `Invalid payment settings for bot ${botId}, using defaults`
      );
      return this.getDefaultSettings(botId);
    }

    return result.data;
  }

  /**
   * Сохранение настроек платежей для бота
   */
  async savePaymentSettings(
    botId: string,
    settings: PaymentSettings
  ): Promise<void> {
    this.logger.log(`Saving payment settings for bot ${botId}`);

    // Валидируем настройки
    const validatedSettings = PaymentSettingsSchema.parse(settings);

    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      throw new NotFoundException(`Бот ${botId} не найден`);
    }

    // Сохраняем в customData
    const customData = (bot as any).customData || {};
    customData.paymentSettings = validatedSettings;

    await this.botRepository.update(botId, {
      customData,
    } as any);

    // Очищаем кеш провайдеров для этого бота
    this.clearProviderCache(botId);

    this.logger.log(`Payment settings saved for bot ${botId}`);
  }

  /**
   * Тестирование платежа
   */
  async testPayment(
    botId: string,
    module: "shop" | "booking" | "api",
    provider: PaymentProvider,
    amount: number,
    currency: string
  ): Promise<PaymentResult> {
    this.logger.log(`Testing payment for bot ${botId}, provider ${provider}`);

    const settings = await this.getPaymentSettings(botId);

    // Принудительно используем тестовый режим
    const paymentProvider = await this.getProvider(
      botId,
      module,
      provider,
      true // testMode = true
    );

    // Валидируем конфигурацию
    const validationResult = await paymentProvider.validateConfig();
    if (!validationResult.valid) {
      throw new PaymentError(
        `Ошибка конфигурации: ${validationResult.errors?.join(", ")}`,
        PaymentErrorCode.INVALID_CONFIG,
        provider,
        false
      );
    }

    // Создаем тестовый платеж
    return paymentProvider.createPayment({
      amount: {
        value: amount,
        currency: currency as any,
      },
      description: "Тестовый платеж",
      orderId: `test_${Date.now()}`,
      metadata: {
        test: true,
        botId,
        module,
      },
    });
  }

  /**
   * Получение провайдера
   */
  private async getProvider(
    botId: string,
    module: "shop" | "booking" | "api",
    provider: PaymentProvider,
    testMode: boolean
  ): Promise<IPaymentProvider> {
    const cacheKey = `${botId}:${module}:${provider}:${testMode}`;

    // Проверяем кеш
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    // Получаем настройки
    const settings = await this.getPaymentSettings(botId);
    const moduleConfig = settings.modules[module];

    // Получаем конфигурацию провайдера
    const providerConfig = moduleConfig.providerSettings[provider];
    if (!providerConfig) {
      throw new PaymentError(
        `Конфигурация провайдера ${provider} не найдена для модуля ${module}`,
        PaymentErrorCode.INVALID_CONFIG,
        provider,
        false
      );
    }

    // Создаем провайдер
    const paymentProvider = this.providerFactory.create(
      provider,
      providerConfig,
      testMode
    );

    // Кешируем
    this.providerCache.set(cacheKey, paymentProvider);

    return paymentProvider;
  }

  /**
   * Очистка кеша провайдеров для бота
   */
  private clearProviderCache(botId: string): void {
    const keysToDelete: string[] = [];

    this.providerCache.forEach((_, key) => {
      if (key.startsWith(`${botId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.providerCache.delete(key));
  }

  /**
   * Валидация суммы
   */
  private validateAmount(
    amount: number,
    minAmount?: number,
    maxAmount?: number
  ): void {
    if (minAmount !== undefined && amount < minAmount) {
      throw new PaymentError(
        `Сумма ${amount} меньше минимальной ${minAmount}`,
        PaymentErrorCode.INVALID_AMOUNT,
        "yookassa", // Временный провайдер для ошибки
        false
      );
    }

    if (maxAmount !== undefined && amount > maxAmount) {
      throw new PaymentError(
        `Сумма ${amount} больше максимальной ${maxAmount}`,
        PaymentErrorCode.INVALID_AMOUNT,
        "yookassa",
        false
      );
    }
  }

  /**
   * Дефолтные настройки
   */
  private getDefaultSettings(botId: string): PaymentSettings {
    const defaultModuleConfig: ModuleConfig = {
      settings: {
        enabled: false,
        currency: "RUB",
        webhookUrl: "",
        supportedPaymentMethods: ["card", "sbp"],
        requireCustomerData: true,
        allowPartialPayments: false,
        sendPaymentConfirmations: true,
        sendReceipts: true,
      },
      providers: [],
      providerSettings: {},
    };

    return {
      global: {
        enabled: false,
        testMode: true,
      },
      modules: {
        shop: { ...defaultModuleConfig },
        booking: { ...defaultModuleConfig },
        api: { ...defaultModuleConfig },
      },
    };
  }
}
