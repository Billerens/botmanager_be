import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  IPaymentProviderFactory,
  ProviderConfig,
  PaymentError,
  PaymentErrorCode,
} from '../interfaces/payment-provider.interface';
import {
  PaymentProvider,
  YookassaConfig,
  TinkoffConfig,
  RobokassaConfig,
  StripeConfig,
  YookassaConfigSchema,
  TinkoffConfigSchema,
  RobokassaConfigSchema,
  StripeConfigSchema,
} from '../schemas/payment.schemas';
import { YookassaProvider } from './yookassa.provider';
import { TinkoffProvider } from './tinkoff.provider';
import { RobokassaProvider } from './robokassa.provider';
import { StripeProvider } from './stripe.provider';

/**
 * Фабрика для создания экземпляров платежных провайдеров
 */
@Injectable()
export class PaymentProviderFactory implements IPaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  /**
   * Создание провайдера по типу и конфигурации
   */
  create(
    type: PaymentProvider,
    config: ProviderConfig,
    testMode: boolean = false,
  ): IPaymentProvider {
    this.logger.log(`Creating payment provider: ${type}, testMode: ${testMode}`);

    // Валидируем конфигурацию
    this.validateConfig(type, config);

    switch (type) {
      case 'yookassa':
        return new YookassaProvider(config as YookassaConfig, testMode);

      case 'tinkoff':
        return new TinkoffProvider(config as TinkoffConfig, testMode);

      case 'robokassa':
        return new RobokassaProvider(config as RobokassaConfig, testMode);

      case 'stripe':
        return new StripeProvider(config as StripeConfig, testMode);

      default:
        throw new PaymentError(
          `Неизвестный тип провайдера: ${type}`,
          PaymentErrorCode.INVALID_CONFIG,
          type,
          false,
        );
    }
  }

  /**
   * Получение списка поддерживаемых провайдеров
   */
  getSupportedProviders(): PaymentProvider[] {
    return ['yookassa', 'tinkoff', 'robokassa', 'stripe'];
  }

  /**
   * Проверка поддержки провайдера
   */
  isProviderSupported(type: string): type is PaymentProvider {
    return this.getSupportedProviders().includes(type as PaymentProvider);
  }

  /**
   * Валидация конфигурации провайдера
   */
  private validateConfig(type: PaymentProvider, config: ProviderConfig): void {
    let result;

    switch (type) {
      case 'yookassa':
        result = YookassaConfigSchema.safeParse(config);
        break;

      case 'tinkoff':
        result = TinkoffConfigSchema.safeParse(config);
        break;

      case 'robokassa':
        result = RobokassaConfigSchema.safeParse(config);
        break;

      case 'stripe':
        result = StripeConfigSchema.safeParse(config);
        break;

      default:
        throw new PaymentError(
          `Неизвестный тип провайдера: ${type}`,
          PaymentErrorCode.INVALID_CONFIG,
          type,
          false,
        );
    }

    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(', ');
      throw new PaymentError(
        `Ошибка конфигурации ${type}: ${errors}`,
        PaymentErrorCode.INVALID_CONFIG,
        type,
        false,
      );
    }
  }

  /**
   * Получение информации о провайдере
   */
  getProviderInfo(type: PaymentProvider): {
    name: string;
    description: string;
    currencies: string[];
    features: string[];
  } {
    const providerInfo: Record<
      PaymentProvider,
      {
        name: string;
        description: string;
        currencies: string[];
        features: string[];
      }
    > = {
      yookassa: {
        name: 'ЮKassa',
        description: 'Популярная российская платежная система',
        currencies: ['RUB', 'USD', 'EUR'],
        features: ['Онлайн-касса', 'СБП', 'Карты', 'Кошельки'],
      },
      tinkoff: {
        name: 'Тинькофф Оплата',
        description: 'Платежная система банка Тинькофф',
        currencies: ['RUB'],
        features: ['Онлайн-касса', 'Рассрочка', 'Карты', 'СБП'],
      },
      robokassa: {
        name: 'Robokassa',
        description: 'Агрегатор платежей с множеством методов',
        currencies: ['RUB', 'USD', 'EUR'],
        features: ['100+ методов', 'Карты', 'Кошельки', 'Криптовалюта'],
      },
      stripe: {
        name: 'Stripe',
        description: 'Международная платежная система',
        currencies: ['RUB', 'USD', 'EUR', 'GBP'],
        features: ['135+ валют', 'Apple Pay', 'Google Pay', 'Карты'],
      },
    };

    return providerInfo[type];
  }
}

