import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PaymentConfigService } from "./payment-config.service";
import { PaymentProviderFactory } from "../providers/payment-provider.factory";
import { PaymentEntityType } from "../../../database/entities/payment-config.entity";
import {
  IPaymentProvider,
  ValidationResult,
  PaymentResult,
} from "../interfaces/payment-provider.interface";
import axios from "axios";

/**
 * Шаг теста
 */
export interface TestStep {
  name: string;
  success: boolean;
  message: string;
  duration?: number;
  details?: Record<string, any>;
}

/**
 * Результат тестирования провайдера
 */
export interface ProviderTestResult {
  provider: string;
  success: boolean;
  steps: TestStep[];
  recommendations: string[];
  testPayment?: PaymentResult;
}

/**
 * Результат симуляции webhook
 */
export interface WebhookSimulationResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

/**
 * События webhook для симуляции
 */
export enum WebhookEventType {
  PAYMENT_SUCCEEDED = "payment.succeeded",
  PAYMENT_CANCELED = "payment.canceled",
  PAYMENT_WAITING_FOR_CAPTURE = "payment.waiting_for_capture",
  REFUND_SUCCEEDED = "refund.succeeded",
}

/**
 * Сервис для тестирования настроек платежей
 *
 * Обеспечивает:
 * - Комплексное тестирование провайдеров
 * - Валидацию конфигурации
 * - Тестовые платежи
 * - Симуляцию webhook
 */
@Injectable()
export class PaymentTestService {
  private readonly logger = new Logger(PaymentTestService.name);

  // Минимальные суммы для тестовых платежей по провайдерам
  private readonly minTestAmounts: Record<string, number> = {
    yookassa: 1,
    tinkoff: 1,
    robokassa: 1,
    stripe: 0.5, // 50 центов
    crypto_trc20: 1, // 1 USDT
  };

  constructor(
    private readonly configService: PaymentConfigService,
    private readonly providerFactory: PaymentProviderFactory
  ) {}

  /**
   * Комплексный тест провайдера
   */
  async runProviderTest(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string,
    options?: {
      skipPaymentTest?: boolean;
      testAmount?: number;
    }
  ): Promise<ProviderTestResult> {
    this.logger.log(
      `Running provider test for ${provider} on ${entityType}:${entityId}`
    );

    const steps: TestStep[] = [];
    let testPayment: PaymentResult | undefined;

    // 1. Проверка конфигурации
    const configStep = await this.testConfigValidation(
      entityType,
      entityId,
      provider
    );
    steps.push(configStep);

    if (!configStep.success) {
      return this.buildResult(provider, steps);
    }

    // 2. Получение провайдера
    const providerStep = await this.testProviderCreation(
      entityType,
      entityId,
      provider
    );
    steps.push(providerStep);

    if (!providerStep.success) {
      return this.buildResult(provider, steps);
    }

    const paymentProvider = providerStep.details?.provider as IPaymentProvider;

    // 3. Валидация конфигурации провайдера (API тест)
    const validationStep = await this.testProviderValidation(paymentProvider);
    steps.push(validationStep);

    if (!validationStep.success) {
      return this.buildResult(provider, steps);
    }

    // 4. Тестовый платёж (опционально)
    if (!options?.skipPaymentTest) {
      const paymentStep = await this.testPaymentCreation(
        paymentProvider,
        provider,
        options?.testAmount
      );
      steps.push(paymentStep);
      testPayment = paymentStep.details?.payment as PaymentResult;
    }

    // 5. Проверка webhook URL
    const config = await this.configService.getConfigInternal(
      entityType,
      entityId
    );
    if (config.settings?.webhookUrl) {
      const webhookStep = await this.testWebhookEndpoint(
        config.settings.webhookUrl
      );
      steps.push(webhookStep);
    }

    return this.buildResult(provider, steps, testPayment);
  }

  /**
   * Тестирование только конфигурации (без создания платежа)
   */
  async testConfigOnly(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string
  ): Promise<ProviderTestResult> {
    return this.runProviderTest(entityType, entityId, provider, {
      skipPaymentTest: true,
    });
  }

  /**
   * Создание тестового платежа
   */
  async createTestPayment(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string,
    amount?: number,
    currency?: string
  ): Promise<PaymentResult> {
    this.logger.log(
      `Creating test payment for ${provider} on ${entityType}:${entityId}`
    );

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      entityType,
      entityId
    );

    if (!config.enabled) {
      throw new BadRequestException("Платежи не включены для этой сущности");
    }

    if (!config.providers.includes(provider)) {
      throw new BadRequestException(
        `Провайдер ${provider} не активирован`
      );
    }

    // Создаём провайдер
    const providerConfig = config.providerSettings[provider];
    if (!providerConfig) {
      throw new BadRequestException(
        `Настройки провайдера ${provider} не найдены`
      );
    }

    const paymentProvider = this.providerFactory.create(
      provider as any,
      providerConfig,
      config.testMode
    );

    // Определяем сумму и валюту
    const testAmount = amount || this.minTestAmounts[provider] || 1;
    const testCurrency = currency || config.settings?.currency || "RUB";

    // Создаём платёж
    const result = await paymentProvider.createPayment({
      amount: {
        value: testAmount,
        currency: testCurrency as any,
      },
      description: `Тестовый платёж (${entityType}:${entityId})`,
      orderId: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      metadata: {
        test: true,
        entityType,
        entityId,
        provider,
      },
    });

    this.logger.log(`Test payment created: ${result.id}`);

    return result;
  }

  /**
   * Симуляция webhook
   */
  async simulateWebhook(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string,
    event: WebhookEventType,
    paymentId?: string
  ): Promise<WebhookSimulationResult> {
    this.logger.log(
      `Simulating webhook ${event} for ${provider} on ${entityType}:${entityId}`
    );

    // Получаем конфигурацию
    const config = await this.configService.getConfigInternal(
      entityType,
      entityId
    );

    if (!config.settings?.webhookUrl) {
      return {
        success: false,
        error: "Webhook URL не настроен",
      };
    }

    // Генерируем тестовый payload
    const payload = this.generateWebhookPayload(
      provider,
      event,
      paymentId || `test_${Date.now()}`
    );

    // Отправляем запрос
    const startTime = Date.now();

    try {
      const response = await axios.post(config.settings.webhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Test-Webhook": "true",
        },
        timeout: 10000,
        validateStatus: () => true, // Принимаем любой статус
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        responseTime,
        error:
          response.status >= 400
            ? `HTTP ${response.status}: ${response.statusText}`
            : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message || "Ошибка отправки webhook",
      };
    }
  }

  // ============================================
  // Приватные методы тестирования
  // ============================================

  /**
   * Тест валидации конфигурации
   */
  private async testConfigValidation(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string
  ): Promise<TestStep> {
    const startTime = Date.now();

    try {
      const config = await this.configService.getConfigInternal(
        entityType,
        entityId
      );

      if (!config.enabled) {
        return {
          name: "Проверка конфигурации",
          success: false,
          message: "Платежи не включены для этой сущности",
          duration: Date.now() - startTime,
        };
      }

      if (!config.providers.includes(provider)) {
        return {
          name: "Проверка конфигурации",
          success: false,
          message: `Провайдер ${provider} не активирован`,
          duration: Date.now() - startTime,
        };
      }

      if (!config.providerSettings[provider]) {
        return {
          name: "Проверка конфигурации",
          success: false,
          message: `Настройки провайдера ${provider} не найдены`,
          duration: Date.now() - startTime,
        };
      }

      return {
        name: "Проверка конфигурации",
        success: true,
        message: "Конфигурация найдена и валидна",
        duration: Date.now() - startTime,
        details: {
          testMode: config.testMode,
          currency: config.settings?.currency,
        },
      };
    } catch (error: any) {
      return {
        name: "Проверка конфигурации",
        success: false,
        message: error.message || "Ошибка получения конфигурации",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Тест создания провайдера
   */
  private async testProviderCreation(
    entityType: PaymentEntityType,
    entityId: string,
    provider: string
  ): Promise<TestStep> {
    const startTime = Date.now();

    try {
      const config = await this.configService.getConfigInternal(
        entityType,
        entityId
      );

      const providerConfig = config.providerSettings[provider];
      const paymentProvider = this.providerFactory.create(
        provider as any,
        providerConfig,
        config.testMode
      );

      return {
        name: "Создание провайдера",
        success: true,
        message: `Провайдер ${provider} создан успешно`,
        duration: Date.now() - startTime,
        details: {
          provider: paymentProvider,
          info: paymentProvider.info,
        },
      };
    } catch (error: any) {
      return {
        name: "Создание провайдера",
        success: false,
        message: error.message || "Ошибка создания провайдера",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Тест валидации провайдера (API тест)
   */
  private async testProviderValidation(
    provider: IPaymentProvider
  ): Promise<TestStep> {
    const startTime = Date.now();

    try {
      const result: ValidationResult = await provider.validateConfig();

      return {
        name: "Проверка API соединения",
        success: result.valid,
        message: result.valid
          ? "Соединение с API провайдера успешно"
          : result.errors?.join(", ") || "Ошибка валидации",
        duration: Date.now() - startTime,
        details: { validationResult: result },
      };
    } catch (error: any) {
      return {
        name: "Проверка API соединения",
        success: false,
        message: error.message || "Ошибка подключения к API провайдера",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Тест создания платежа
   */
  private async testPaymentCreation(
    provider: IPaymentProvider,
    providerName: string,
    testAmount?: number
  ): Promise<TestStep> {
    const startTime = Date.now();

    try {
      const amount = testAmount || this.minTestAmounts[providerName] || 1;
      const currency = provider.info.supportedCurrencies[0] || "RUB";

      const result = await provider.createPayment({
        amount: { value: amount, currency },
        description: "Тестовый платёж",
        orderId: `test_${Date.now()}`,
        metadata: { test: true },
      });

      return {
        name: "Создание тестового платежа",
        success: true,
        message: `Платёж создан: ${result.id}`,
        duration: Date.now() - startTime,
        details: {
          payment: result,
          paymentUrl: result.paymentUrl,
        },
      };
    } catch (error: any) {
      return {
        name: "Создание тестового платежа",
        success: false,
        message: error.message || "Ошибка создания платежа",
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Тест webhook endpoint
   */
  private async testWebhookEndpoint(webhookUrl: string): Promise<TestStep> {
    const startTime = Date.now();

    try {
      // Проверяем URL
      new URL(webhookUrl);

      // Отправляем тестовый запрос (HEAD или OPTIONS)
      const response = await axios.head(webhookUrl, {
        timeout: 5000,
        validateStatus: () => true,
      });

      // Проверяем доступность (любой ответ кроме сетевых ошибок - OK)
      return {
        name: "Проверка Webhook URL",
        success: true,
        message: `Webhook URL доступен (HTTP ${response.status})`,
        duration: Date.now() - startTime,
        details: {
          url: webhookUrl,
          statusCode: response.status,
        },
      };
    } catch (error: any) {
      return {
        name: "Проверка Webhook URL",
        success: false,
        message: error.message || "Webhook URL недоступен",
        duration: Date.now() - startTime,
        details: { url: webhookUrl },
      };
    }
  }

  /**
   * Построение результата теста
   */
  private buildResult(
    provider: string,
    steps: TestStep[],
    testPayment?: PaymentResult
  ): ProviderTestResult {
    const success = steps.every((s) => s.success);
    const recommendations = this.generateRecommendations(steps);

    return {
      provider,
      success,
      steps,
      recommendations,
      testPayment,
    };
  }

  /**
   * Генерация рекомендаций на основе результатов тестов
   */
  private generateRecommendations(steps: TestStep[]): string[] {
    const recommendations: string[] = [];

    for (const step of steps) {
      if (!step.success) {
        switch (step.name) {
          case "Проверка конфигурации":
            recommendations.push(
              "Проверьте, что платежи включены и провайдер активирован"
            );
            break;
          case "Создание провайдера":
            recommendations.push(
              "Проверьте правильность настроек провайдера (ключи, пароли)"
            );
            break;
          case "Проверка API соединения":
            recommendations.push(
              "Проверьте учётные данные провайдера и доступность API"
            );
            recommendations.push(
              "Убедитесь, что используете правильный режим (тест/прод)"
            );
            break;
          case "Создание тестового платежа":
            recommendations.push(
              "Проверьте баланс тестового аккаунта и лимиты"
            );
            break;
          case "Проверка Webhook URL":
            recommendations.push(
              "Убедитесь, что webhook URL доступен из интернета"
            );
            recommendations.push("Проверьте SSL сертификат для HTTPS");
            break;
        }
      }
    }

    return [...new Set(recommendations)]; // Убираем дубликаты
  }

  /**
   * Генерация тестового payload для webhook
   */
  private generateWebhookPayload(
    provider: string,
    event: WebhookEventType,
    paymentId: string
  ): any {
    const basePayload = {
      event,
      object: {
        id: paymentId,
        status: this.mapEventToStatus(event),
        amount: { value: "100.00", currency: "RUB" },
        created_at: new Date().toISOString(),
        metadata: { test: true },
      },
    };

    // Кастомизация для разных провайдеров
    switch (provider) {
      case "yookassa":
        return {
          type: "notification",
          event,
          object: basePayload.object,
        };

      case "stripe":
        return {
          id: `evt_test_${Date.now()}`,
          type: event.replace(".", "_"),
          data: { object: basePayload.object },
        };

      default:
        return basePayload;
    }
  }

  /**
   * Маппинг события в статус
   */
  private mapEventToStatus(event: WebhookEventType): string {
    const statusMap: Record<WebhookEventType, string> = {
      [WebhookEventType.PAYMENT_SUCCEEDED]: "succeeded",
      [WebhookEventType.PAYMENT_CANCELED]: "canceled",
      [WebhookEventType.PAYMENT_WAITING_FOR_CAPTURE]: "waiting_for_capture",
      [WebhookEventType.REFUND_SUCCEEDED]: "refunded",
    };

    return statusMap[event] || "pending";
  }
}

