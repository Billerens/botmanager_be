import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

/**
 * Информация о модели AI
 */
export interface AiModelInfo {
  id: string;
  name: string;
  contextLength: number;
  priority: number;
  parametersEstimate: number; // Приблизительное количество параметров (в миллиардах)
}

/**
 * Сервис для автоматического выбора бесплатной AI модели OpenRouter
 *
 * Приоритеты моделей:
 * 1. grok - приоритет 1 (наивысший)
 * 2. gemini - приоритет 2
 * 3. deepseek - приоритет 3
 * 4. gpt - приоритет 4
 * 5. llama - приоритет 5
 * 6. qwen - приоритет 6
 * 7. остальные - приоритет 7
 *
 * Критерии отбора:
 * - Модель бесплатная (pricing.prompt === "0" и pricing.completion === "0")
 * - Количество параметров >= 20B (парсинг из названия/ID)
 */
@Injectable()
export class AiModelSelectorService {
  private readonly logger = new Logger(AiModelSelectorService.name);
  private readonly baseUrl: string;

  // Кэш моделей
  private cachedModels: AiModelInfo[] = [];
  private cacheTimestamp: number = 0;
  private readonly cacheTtl = 60 * 60 * 1000; // 1 час в миллисекундах

  // Приоритеты моделей по провайдеру (поиск по вхождению подстроки в название)
  private readonly modelPriorities: Record<string, number> = {
    grok: 1,
    deepseek: 2,
    llama: 3,
    gpt: 4,
    gemini: 5,
    qwen: 6,
    gemma: 7,

    // default (остальные модели)
    default: 8,
  };

  // Минимальное количество параметров (в миллиардах)
  private readonly minParameters = 20;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("openrouter.baseUrl") ||
      "https://openrouter.ai/api/v1";
    this.logger.log("AiModelSelectorService инициализирован");
  }

  /**
   * Получает предпочтительную модель для использования
   */
  async getPreferredModel(): Promise<string> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      this.logger.warn("Нет доступных бесплатных моделей с >= 20B параметров");
      // Fallback к дефолтной модели
      return "meta-llama/llama-3.3-70b-instruct:free";
    }

    // Возвращаем первую модель (уже отсортированы по приоритету)
    const selectedModel = models[0];
    this.logger.log(
      `Выбрана модель: ${selectedModel.id} (приоритет: ${selectedModel.priority}, ~${selectedModel.parametersEstimate}B параметров)`
    );

    return selectedModel.id;
  }

  /**
   * Получает список доступных бесплатных моделей с >= 30B параметров
   */
  async getAvailableModels(): Promise<AiModelInfo[]> {
    // Проверяем кэш
    const now = Date.now();
    if (
      this.cachedModels.length > 0 &&
      now - this.cacheTimestamp < this.cacheTtl
    ) {
      this.logger.debug(
        `Используем кэшированный список моделей (${this.cachedModels.length} моделей)`
      );
      return this.cachedModels;
    }

    try {
      this.logger.debug("Загружаем список моделей из OpenRouter API");

      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      const allModels = response.data?.data || [];
      this.logger.debug(`Получено ${allModels.length} моделей из OpenRouter`);

      // Фильтруем бесплатные модели
      const freeModels = allModels.filter((model: any) => {
        const isPromptFree =
          model.pricing?.prompt === "0" || model.pricing?.prompt === "0.0";
        const isCompletionFree =
          model.pricing?.completion === "0" ||
          model.pricing?.completion === "0.0";
        return isPromptFree && isCompletionFree;
      });

      this.logger.debug(`Найдено ${freeModels.length} бесплатных моделей`);

      // Преобразуем и фильтруем по количеству параметров
      const processedModels: AiModelInfo[] = [];

      for (const model of freeModels) {
        const parametersEstimate = this.estimateParameters(
          model.id,
          model.name
        );

        if (parametersEstimate >= this.minParameters) {
          const priority = this.getModelPriority(model.id, model.name);

          processedModels.push({
            id: model.id,
            name: model.name,
            contextLength: model.context_length || 0,
            priority,
            parametersEstimate,
          });
        }
      }

      this.logger.debug(
        `После фильтрации по параметрам (>= ${this.minParameters}B): ${processedModels.length} моделей`
      );

      // Сортируем по приоритету (меньше = лучше) и затем по количеству параметров (больше = лучше)
      processedModels.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.parametersEstimate - a.parametersEstimate;
      });

      // Обновляем кэш
      this.cachedModels = processedModels;
      this.cacheTimestamp = now;

      this.logger.log(
        `Доступно ${processedModels.length} бесплатных моделей с >= ${this.minParameters}B параметров`
      );
      if (processedModels.length > 0) {
        this.logger.log(
          `Топ-3 модели: ${processedModels
            .slice(0, 3)
            .map((m) => m.id)
            .join(", ")}`
        );
      }

      return processedModels;
    } catch (error) {
      this.logger.error(`Ошибка загрузки списка моделей: ${error.message}`);

      // Возвращаем кэш, если есть
      if (this.cachedModels.length > 0) {
        this.logger.warn("Используем устаревший кэш моделей");
        return this.cachedModels;
      }

      return [];
    }
  }

  /**
   * Выполняет действие с автоматическим fallback к другим моделям
   * Возвращает результат и информацию о использованной модели
   */
  async executeWithFallback<T>(
    action: (modelId: string) => Promise<T>,
    maxRetries: number = 3
  ): Promise<{ result: T; modelId: string; modelName: string }> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      // Пробуем дефолтную модель
      this.logger.warn("Нет кэшированных моделей, пробуем дефолтную");
      const defaultModelId = "meta-llama/llama-3.3-70b-instruct:free";
      const result = await action(defaultModelId);
      return {
        result,
        modelId: defaultModelId,
        modelName: "Meta Llama 3.3 70B (free)",
      };
    }

    let lastError: Error | null = null;
    const modelsToTry = models.slice(0, maxRetries);

    for (const model of modelsToTry) {
      try {
        this.logger.debug(`Пробуем модель: ${model.id}`);
        const result = await action(model.id);
        return {
          result,
          modelId: model.id,
          modelName: model.name,
        };
      } catch (error) {
        this.logger.warn(`Модель ${model.id} недоступна: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    // Если все модели из списка не сработали, пробуем fallback
    if (lastError) {
      this.logger.error(
        `Все ${modelsToTry.length} модели недоступны, последняя ошибка: ${lastError.message}`
      );
      throw lastError;
    }

    throw new Error("Нет доступных AI моделей");
  }

  /**
   * Выполняет streaming действие с автоматическим fallback к другим моделям
   * Возвращает AsyncGenerator и информацию о модели
   */
  async executeStreamingWithFallback(
    createStream: (modelId: string) => AsyncGenerator<string, void, unknown>,
    maxRetries: number = 3
  ): Promise<{
    stream: AsyncGenerator<string, void, unknown>;
    modelId: string;
    modelName: string;
  }> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      const defaultModelId = "meta-llama/llama-3.3-70b-instruct:free";
      this.logger.warn("Нет кэшированных моделей, пробуем дефолтную");
      return {
        stream: createStream(defaultModelId),
        modelId: defaultModelId,
        modelName: "Meta Llama 3.3 70B (free)",
      };
    }

    let lastError: Error | null = null;
    const modelsToTry = models.slice(0, maxRetries);

    for (const model of modelsToTry) {
      try {
        this.logger.debug(`Пробуем streaming модель: ${model.id}`);

        // Создаём обёртку-генератор, который проверяет первый чанк
        const stream = createStream(model.id);

        // Пытаемся получить первый чанк для проверки работоспособности
        const wrappedStream = this.createValidatingStream(stream, model.id);

        return {
          stream: wrappedStream,
          modelId: model.id,
          modelName: model.name,
        };
      } catch (error) {
        this.logger.warn(
          `Streaming модель ${model.id} недоступна: ${error.message}`
        );
        lastError = error;
        continue;
      }
    }

    if (lastError) {
      this.logger.error(
        `Все ${modelsToTry.length} streaming модели недоступны`
      );
      throw lastError;
    }

    throw new Error("Нет доступных AI моделей для streaming");
  }

  /**
   * Создаёт обёртку над stream с валидацией
   */
  private async *createValidatingStream(
    stream: AsyncGenerator<string, void, unknown>,
    modelId: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Streaming error для ${modelId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает первую доступную модель для streaming
   */
  async getStreamingModel(): Promise<{ modelId: string; modelName: string }> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      return {
        modelId: "meta-llama/llama-3.3-70b-instruct:free",
        modelName: "Meta Llama 3.3 70B (free)",
      };
    }

    return {
      modelId: models[0].id,
      modelName: models[0].name,
    };
  }

  /**
   * Оценивает количество параметров модели на основе ID и названия
   */
  private estimateParameters(modelId: string, modelName: string): number {
    const text = `${modelId} ${modelName}`.toLowerCase();

    // Ищем паттерны вида "70b", "32b", "7b" и т.д.
    const patterns = [
      /(\d+)b(?:\s|$|-|_|:)/, // 70b, 32b
      /(\d+\.?\d*)b/, // 7.1b
      /(\d+)-b/, // 70-b
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const params = parseFloat(match[1]);
        if (!isNaN(params)) {
          return params;
        }
      }
    }

    // Специальные случаи для известных моделей без явного указания параметров
    const knownModels: Record<string, number> = {
      "grok-2": 314, // Grok-2 имеет ~314B параметров
      "grok-3": 500, // Примерная оценка
      "gemini-pro": 50,
      "gemini-1.5": 50,
      "gemini-2": 50,
      "gpt-4": 175,
      "gpt-4o": 175,
    };

    for (const [key, value] of Object.entries(knownModels)) {
      if (text.includes(key)) {
        return value;
      }
    }

    // Неизвестная модель - возвращаем 0
    return 0;
  }

  /**
   * Определяет приоритет модели
   */
  private getModelPriority(modelId: string, modelName: string): number {
    const text = `${modelId} ${modelName}`.toLowerCase();

    for (const [keyword, priority] of Object.entries(this.modelPriorities)) {
      if (text.includes(keyword)) {
        return priority;
      }
    }

    // Дефолтный приоритет для остальных моделей
    return this.modelPriorities.default;
  }

  /**
   * Принудительно обновляет кэш моделей
   */
  async refreshCache(): Promise<void> {
    this.cacheTimestamp = 0;
    await this.getAvailableModels();
  }

  /**
   * Возвращает информацию о сервисе
   */
  getServiceInfo() {
    return {
      service: "AiModelSelectorService",
      cachedModelsCount: this.cachedModels.length,
      cacheAge:
        this.cacheTimestamp > 0
          ? Math.floor((Date.now() - this.cacheTimestamp) / 1000) + "s"
          : "empty",
      minParameters: this.minParameters,
      priorities: this.modelPriorities,
    };
  }
}
