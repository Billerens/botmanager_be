import { Injectable, Logger } from "@nestjs/common";
import { CryptoExchange, Currency } from "../schemas/payment.schemas";

export interface ExchangeRate {
  source: CryptoExchange;
  baseCurrency: Currency;
  quoteCurrency: string; // USDT
  rate: number;
  timestamp: Date;
}

// Forex курсы валют к USD (кэш)
interface ForexRates {
  rates: Record<string, number>;
  timestamp: number;
}

/**
 * Сервис получения курсов криптовалют
 * Поддерживает Binance, CoinGecko, Coinbase, Kraken
 * С умным фолбэком через буферную валюту (USD)
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  // Кэш курсов (source:pair -> rate)
  private rateCache: Map<string, { rate: number; timestamp: number }> =
    new Map();

  // Кэш forex курсов
  private forexCache: ForexRates | null = null;

  // Время жизни кэша в мс (1 минута)
  private readonly CACHE_TTL_MS = 60_000;

  // Время жизни forex кэша (5 минут)
  private readonly FOREX_CACHE_TTL_MS = 300_000;

  /**
   * Получение курса фиат -> USDT
   */
  async getExchangeRate(
    source: CryptoExchange,
    fromCurrency: Currency,
    manualRate?: number
  ): Promise<number> {
    // Ручной курс
    if (source === "manual") {
      if (!manualRate) {
        throw new Error("Manual rate is required when source is 'manual'");
      }
      return manualRate;
    }

    const cacheKey = `${source}:${fromCurrency}:USDT`;

    // Проверяем кэш
    const cached = this.rateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.rate;
    }

    // Получаем курс
    let rate: number;

    try {
      switch (source) {
        case "binance":
          rate = await this.getBinanceRate(fromCurrency);
          break;
        case "coingecko":
          rate = await this.getCoinGeckoRate(fromCurrency);
          break;
        case "coinbase":
          rate = await this.getCoinbaseRate(fromCurrency);
          break;
        case "kraken":
          rate = await this.getKrakenRate(fromCurrency);
          break;
        default:
          throw new Error(`Unknown exchange source: ${source}`);
      }

      // Сохраняем в кэш
      this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });

      this.logger.log(
        `Exchange rate ${fromCurrency}/USDT from ${source}: ${rate}`
      );

      return rate;
    } catch (error: any) {
      this.logger.error(`Failed to get rate from ${source}: ${error.message}`);

      // Пробуем вернуть старое закэшированное значение
      if (cached) {
        this.logger.warn(`Using stale cache for ${cacheKey}`);
        return cached.rate;
      }

      throw error;
    }
  }

  /**
   * Конвертация суммы из фиата в USDT
   */
  async convertToUsdt(
    amount: number,
    fromCurrency: Currency,
    source: CryptoExchange,
    manualRate?: number,
    markupPercent: number = 0
  ): Promise<{ usdtAmount: number; rate: number }> {
    const rate = await this.getExchangeRate(source, fromCurrency, manualRate);

    // Применяем наценку/скидку
    const adjustedRate = rate * (1 + markupPercent / 100);

    const usdtAmount = amount / adjustedRate;

    return {
      usdtAmount: parseFloat(usdtAmount.toFixed(4)),
      rate: adjustedRate,
    };
  }

  /**
   * Binance API
   * https://api.binance.com/api/v3/ticker/price?symbol=USDTRUB
   */
  private async getBinanceRate(currency: Currency): Promise<number> {
    // Binance использует обратные пары для стейблкоинов
    // Для RUB: USDTRUB показывает сколько RUB за 1 USDT
    const symbol = `USDT${currency}`;

    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    );

    if (!response.ok) {
      // Пробуем через USDT/USD -> USD/CURRENCY
      if (currency !== "USD") {
        return await this.getBinanceRateViaUsd(currency);
      }
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.price);
  }

  /**
   * Binance rate через USD (для валют без прямой пары)
   * Использует реальный Forex API для получения курсов
   */
  private async getBinanceRateViaUsd(currency: Currency): Promise<number> {
    // Получаем реальный курс USD -> currency
    const forexRate = await this.getForexRate(currency);

    // USDT ≈ 1 USD, поэтому курс USDT/currency ≈ USD/currency
    return forexRate;
  }

  /**
   * Получение курса USD -> currency из Forex API
   * Использует бесплатный API exchangerate-api или fallback на frankfurter
   */
  private async getForexRate(currency: Currency): Promise<number> {
    // USD всегда = 1
    if (currency === "USD") {
      return 1;
    }

    // Проверяем кэш
    if (
      this.forexCache &&
      Date.now() - this.forexCache.timestamp < this.FOREX_CACHE_TTL_MS
    ) {
      const cached = this.forexCache.rates[currency];
      if (cached) {
        return cached;
      }
    }

    try {
      // Пробуем exchangerate.host (бесплатный, без API ключа)
      const rates = await this.fetchForexRates();
      return rates[currency] || this.getFallbackForexRate(currency);
    } catch (error: any) {
      this.logger.warn(`Forex API failed: ${error.message}, using fallback`);
      return this.getFallbackForexRate(currency);
    }
  }

  /**
   * Получение курсов от Forex API
   */
  private async fetchForexRates(): Promise<Record<string, number>> {
    // Пробуем несколько API последовательно
    const apis = [
      this.fetchFromFrankfurter.bind(this),
      this.fetchFromExchangeRateApi.bind(this),
    ];

    for (const fetchFn of apis) {
      try {
        const rates = await fetchFn();
        if (rates && Object.keys(rates).length > 0) {
          // Сохраняем в кэш
          this.forexCache = {
            rates,
            timestamp: Date.now(),
          };
          this.logger.log(`Forex rates updated: ${JSON.stringify(rates)}`);
          return rates;
        }
      } catch (error: any) {
        this.logger.debug(`Forex API attempt failed: ${error.message}`);
      }
    }

    throw new Error("All forex APIs failed");
  }

  /**
   * Frankfurter API (бесплатный, без ключа)
   * https://www.frankfurter.app/docs/
   */
  private async fetchFromFrankfurter(): Promise<Record<string, number>> {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,RUB"
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();
    // Frankfurter не поддерживает BYN, добавим расчёт через RUB
    const rates: Record<string, number> = {
      USD: 1,
      ...data.rates,
    };

    // BYN примерно = RUB * 0.036 (курс BYN/RUB)
    if (rates.RUB && !rates.BYN) {
      rates.BYN = rates.RUB * 0.036;
    }

    return rates;
  }

  /**
   * ExchangeRate-API (бесплатный лимит 1500 запросов/месяц)
   * Резервный вариант
   */
  private async fetchFromExchangeRateApi(): Promise<Record<string, number>> {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");

    if (!response.ok) {
      throw new Error(`ExchangeRate-API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      USD: 1,
      EUR: data.rates?.EUR || 0.92,
      GBP: data.rates?.GBP || 0.79,
      RUB: data.rates?.RUB || 90,
      BYN: data.rates?.BYN || 3.2,
    };
  }

  /**
   * Fallback курсы (обновляются периодически вручную)
   * Используются только если все API недоступны
   */
  private getFallbackForexRate(currency: Currency): number {
    const fallbackRates: Record<string, number> = {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      RUB: 90,
      BYN: 3.25,
    };

    this.logger.warn(`Using fallback forex rate for ${currency}`);
    return fallbackRates[currency] || 1;
  }

  /**
   * CoinGecko API (бесплатный)
   * https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub
   */
  private async getCoinGeckoRate(currency: Currency): Promise<number> {
    const currencyLower = currency.toLowerCase();

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${currencyLower}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return data.tether?.[currencyLower] || 0;
  }

  /**
   * Coinbase API
   * https://api.coinbase.com/v2/exchange-rates?currency=USDT
   */
  private async getCoinbaseRate(currency: Currency): Promise<number> {
    const response = await fetch(
      `https://api.coinbase.com/v2/exchange-rates?currency=USDT`
    );

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.data?.rates?.[currency] || "0");
  }

  /**
   * Kraken API
   * https://api.kraken.com/0/public/Ticker?pair=USDTZUSD
   */
  private async getKrakenRate(currency: Currency): Promise<number> {
    // Kraken в основном торгует USD
    // Для других валют конвертируем через USD
    if (currency === "USD") {
      return 1; // USDT ≈ USD
    }

    // Используем fallback на CoinGecko для других валют
    return this.getCoinGeckoRate(currency);
  }

  /**
   * Получение курсов от всех источников для заданной валюты
   */
  async getAllExchangeRates(fromCurrency: Currency): Promise<{
    currency: Currency;
    rates: Array<{
      source: CryptoExchange;
      name: string;
      rate: number | null;
      error?: string;
      timestamp: Date;
    }>;
  }> {
    const sources: Array<{ source: CryptoExchange; name: string }> = [
      { source: "binance", name: "Binance" },
      { source: "coingecko", name: "CoinGecko" },
      { source: "coinbase", name: "Coinbase" },
      { source: "kraken", name: "Kraken" },
    ];

    const ratesPromises = sources.map(async ({ source, name }) => {
      try {
        const rate = await this.getExchangeRate(source, fromCurrency);
        return {
          source,
          name,
          rate,
          timestamp: new Date(),
        };
      } catch (error: any) {
        return {
          source,
          name,
          rate: null,
          error: error.message || "Failed to fetch rate",
          timestamp: new Date(),
        };
      }
    });

    const rates = await Promise.all(ratesPromises);

    return {
      currency: fromCurrency,
      rates,
    };
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.rateCache.clear();
  }

  /**
   * Получение всех закэшированных курсов
   */
  getCachedRates(): Map<string, { rate: number; timestamp: number }> {
    return new Map(this.rateCache);
  }
}
