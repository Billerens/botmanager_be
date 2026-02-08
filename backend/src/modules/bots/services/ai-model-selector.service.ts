import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenRouterAgentSettingsService } from "../../openrouter/openrouter-agent-settings.service";
import { OpenRouterFeaturedService } from "../../openrouter/openrouter-featured.service";
import { OpenRouterService } from "../../../common/openrouter.service";
import { OpenRouterModelDto } from "../../../common/dto/openrouter.dto";

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
 * Сервис выбора AI модели OpenRouter для узлов Bot Flow (AI Single, AI Chat).
 * Использует список платных моделей (getPaidModels); выбор ограничивается
 * настройкой allowedForBotFlowModelIds в админке (если задана — только эти модели).
 * При пустом списке «Разрешить в Bot Flow» первой пробуется модель openrouter/free,
 * при ошибке — фоллбэк на «выбор платформы» (featured) по возрастанию стоимости.
 *
 * Приоритеты моделей:
 * 1. grok - приоритет 1 (наивысший)
 * 2. deepseek - приоритет 2
 * 3. llama - приоритет 3
 * 4. gpt - приоритет 4
 * 5. gemini - приоритет 5
 * 6. qwen - приоритет 6
 * 7. gemma - приоритет 7
 * 8. остальные - приоритет 8
 */
@Injectable()
export class AiModelSelectorService {
  private readonly logger = new Logger(AiModelSelectorService.name);

  /** Модель по умолчанию при пустом списке «Разрешить в Bot Flow» (пробуем первой, при ошибке — фоллбэк на featured) */
  private static readonly DEFAULT_FREE_MODEL_ID = "openrouter/free";

  // Кэш моделей (инвалидируется при изменении allowedForBotFlowModelIds в админке)
  private cachedModels: AiModelInfo[] = [];
  private cacheTimestamp: number = 0;
  private cachedAllowedFlowIdsKey: string | null = null;
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

  constructor(
    private readonly configService: ConfigService,
    private readonly openRouterAgentSettings: OpenRouterAgentSettingsService,
    private readonly openRouterFeaturedService: OpenRouterFeaturedService,
    private readonly openRouterService: OpenRouterService,
  ) {
    this.logger.log(
      "AiModelSelectorService инициализирован (источник: платные модели)",
    );
  }

  /** Стоимость за 1M токенов (prompt + completion) для сортировки по возрастанию цены */
  private getCostPer1M(model: OpenRouterModelDto): number {
    if (!model.pricing) return 0;
    const prompt = parseFloat(String(model.pricing.prompt || 0)) * 1e6;
    const completion = parseFloat(String(model.pricing.completion || 0)) * 1e6;
    return prompt + completion;
  }

  private getDefaultModelId(): string {
    return (
      this.configService.get<string>("openrouter.defaultModel") ||
      "meta-llama/llama-3.3-70b-instruct"
    );
  }

  /**
   * Получает предпочтительную модель для использования
   */
  async getPreferredModel(): Promise<string> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      const defaultId = this.getDefaultModelId();
      this.logger.warn(
        `Нет доступных платных моделей для Bot Flow, fallback: ${defaultId}`,
      );
      return defaultId;
    }

    const selectedModel = models[0];
    this.logger.log(
      `Выбрана модель: ${selectedModel.id} (приоритет: ${selectedModel.priority}, ~${selectedModel.parametersEstimate}B параметров)`,
    );

    return selectedModel.id;
  }

  /**
   * Получает список доступных для Bot Flow моделей (платные модели OpenRouter,
   * при необходимости отфильтрованные по allowedForBotFlowModelIds).
   */
  async getAvailableModels(): Promise<AiModelInfo[]> {
    const now = Date.now();
    const settings = await this.openRouterAgentSettings.getSettings();
    const allowedFlowIds = settings.allowedForBotFlowModelIds || [];
    const currentKey = JSON.stringify([...allowedFlowIds].sort());

    if (
      this.cachedModels.length > 0 &&
      this.cachedAllowedFlowIdsKey === currentKey &&
      now - this.cacheTimestamp < this.cacheTtl
    ) {
      this.logger.debug(
        `Используем кэшированный список моделей (${this.cachedModels.length} моделей)`,
      );
      return this.cachedModels;
    }
    if (this.cachedAllowedFlowIdsKey !== currentKey && this.cachedModels.length > 0) {
      this.logger.debug(
        "Кэш моделей Bot Flow сброшен: изменился список «Разрешить в Bot Flow»",
      );
      this.cachedModels = [];
      this.cacheTimestamp = 0;
      this.cachedAllowedFlowIdsKey = null;
    }

    try {
      const disabledModelIds = settings.disabledModelIds || [];
      const maxCostPerMillion = settings.maxCostPerMillion;

      // Если задан список «Разрешить в Bot Flow» — берём полный список моделей API (getModels),
      // чтобы включить модели любого размера (в т.ч. 7B, 13B). Иначе — платные >27B (getPaidModels) + featured.
      let modelsForFlow: OpenRouterModelDto[];
      if (allowedFlowIds.length > 0) {
        this.logger.debug(
          "Загружаем полный список моделей OpenRouter для Bot Flow (по явному списку разрешённых)",
        );
        const allModelsResult = await this.openRouterService.getModels();
        const allowedSet = new Set(allowedFlowIds);
        const allIds = new Set((allModelsResult.data || []).map((m) => m.id));
        const missingInApi = allowedFlowIds.filter((id) => !allIds.has(id));
        if (missingInApi.length > 0) {
          this.logger.warn(
            `Модели из «Разрешить в Bot Flow» отсутствуют в API OpenRouter (игнорируются): ${missingInApi.join(", ")}`,
          );
        }
        modelsForFlow = (allModelsResult.data || []).filter((m) =>
          allowedSet.has(m.id),
        );
        this.logger.debug(
          `После фильтра «разрешено для Bot Flow»: ${modelsForFlow.length} из ${allModelsResult.data?.length || 0} моделей API`,
        );
      } else {
        this.logger.debug("Загружаем список платных моделей для Bot Flow");
        const [paidResult, featuredIds] = await Promise.all([
          this.openRouterService.getPaidModels(),
          this.openRouterFeaturedService.getFeaturedModelIds(),
        ]);
        const featuredSet = new Set(featuredIds || []);
        modelsForFlow = (paidResult.data || []).filter((m) =>
          featuredSet.has(m.id),
        );
        this.logger.debug(
          `Список «Разрешить в Bot Flow» пуст: используем «выбор платформы» (${modelsForFlow.length} моделей)`,
        );
      }

      // Та же фильтрация, что и для агентов: отключённые модели и лимит по стоимости за 1M токенов
      const disabledSet = new Set(disabledModelIds);
      modelsForFlow = modelsForFlow.filter((m) => {
        if (disabledSet.has(m.id)) return false;
        if (maxCostPerMillion != null && m.pricing) {
          const promptPerMillion =
            parseFloat(String(m.pricing.prompt || 0)) * 1e6;
          const completionPerMillion =
            parseFloat(String(m.pricing.completion || 0)) * 1e6;
          if (
            promptPerMillion > maxCostPerMillion ||
            completionPerMillion > maxCostPerMillion
          ) {
            return false;
          }
        }
        return true;
      });

      // При пустом списке «Разрешить в Bot Flow» сортируем по возрастанию стоимости (минимальная по стоимости первой)
      if (allowedFlowIds.length === 0) {
        modelsForFlow.sort(
          (a, b) => this.getCostPer1M(a) - this.getCostPer1M(b),
        );
      }

      const processedModels: AiModelInfo[] = modelsForFlow.map((model) => {
        const parametersEstimate =
          model.num_parameters != null
            ? model.num_parameters / 1e9
            : this.estimateParameters(model.id, model.name);
        const priority = this.getModelPriority(model.id, model.name);
        return {
          id: model.id,
          name: model.name,
          contextLength: model.context_length || 0,
          priority,
          parametersEstimate,
        };
      });

      // Сортировка: при явном списке «Разрешить в Bot Flow» — по приоритету и параметрам; при пустом — уже по стоимости
      if (allowedFlowIds.length > 0) {
        processedModels.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return b.parametersEstimate - a.parametersEstimate;
        });
      } else {
        // При пустом списке первой пробуем openrouter/free, при ошибке — фоллбэк на featured по стоимости
        processedModels.unshift({
          id: AiModelSelectorService.DEFAULT_FREE_MODEL_ID,
          name: "OpenRouter Free",
          contextLength: 0,
          priority: 0,
          parametersEstimate: 0,
        });
        this.logger.debug(
          "Список «Разрешить в Bot Flow» пуст: первой пробуем openrouter/free, при ошибке — featured по стоимости",
        );
      }

      this.cachedModels = processedModels;
      this.cacheTimestamp = now;
      this.cachedAllowedFlowIdsKey = currentKey;

      this.logger.log(
        `Доступно ${this.cachedModels.length} платных моделей для Bot Flow`,
      );
      if (this.cachedModels.length > 0) {
        this.logger.log(
          `Топ-3 модели: ${this.cachedModels
            .slice(0, 3)
            .map((m) => m.id)
            .join(", ")}`,
        );
      }

      return this.cachedModels;
    } catch (error) {
      this.logger.error(`Ошибка загрузки списка моделей: ${error.message}`);

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
    maxRetries: number = 3,
  ): Promise<{ result: T; modelId: string; modelName: string }> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      const defaultModelId = this.getDefaultModelId();
      this.logger.warn(
        `Нет кэшированных моделей для Bot Flow, пробуем: ${defaultModelId}`,
      );
      const result = await action(defaultModelId);
      return {
        result,
        modelId: defaultModelId,
        modelName: defaultModelId,
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
        `Все ${modelsToTry.length} модели недоступны, последняя ошибка: ${lastError.message}`,
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
    maxRetries: number = 3,
  ): Promise<{
    stream: AsyncGenerator<string, void, unknown>;
    modelId: string;
    modelName: string;
  }> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      const defaultModelId = this.getDefaultModelId();
      this.logger.warn(
        `Нет кэшированных моделей для Bot Flow, пробуем: ${defaultModelId}`,
      );
      return {
        stream: createStream(defaultModelId),
        modelId: defaultModelId,
        modelName: defaultModelId,
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
          `Streaming модель ${model.id} недоступна: ${error.message}`,
        );
        lastError = error;
        continue;
      }
    }

    if (lastError) {
      this.logger.error(
        `Все ${modelsToTry.length} streaming модели недоступны`,
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
    modelId: string,
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
      const defaultModelId = this.getDefaultModelId();
      return {
        modelId: defaultModelId,
        modelName: defaultModelId,
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
   * Сбрасывает кэш списка моделей (после сохранения allowedForBotFlowModelIds в админке).
   * Следующий вызов getAvailableModels() загрузит актуальные настройки и пересоберёт список.
   */
  invalidateCache(): void {
    this.cachedModels = [];
    this.cacheTimestamp = 0;
    this.cachedAllowedFlowIdsKey = null;
    this.logger.debug("Кэш списка моделей Bot Flow сброшен (invalidateCache)");
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
      source: "paid",
      cachedModelsCount: this.cachedModels.length,
      cacheAge:
        this.cacheTimestamp > 0
          ? Math.floor((Date.now() - this.cacheTimestamp) / 1000) + "s"
          : "empty",
      priorities: this.modelPriorities,
    };
  }
}
