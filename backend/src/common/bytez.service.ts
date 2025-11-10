import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Bytez from "bytez.js";
import {
  BytezModelRunDto,
  BytezModelResponseDto,
  BytezModelInfoDto,
} from "./dto/bytez.dto";

@Injectable()
export class BytezService {
  private readonly logger = new Logger(BytezService.name);
  private readonly bytezClient: Bytez;

  constructor(private configService: ConfigService) {
    const bytezConfig = this.configService.get("bytez");
    const apiKey = bytezConfig?.apiKey;

    if (!apiKey) {
      this.logger.warn(
        "BYTEZ_API_KEY не установлен в переменных окружения. Некоторые функции могут быть недоступны."
      );
    }

    // Инициализируем клиент bytez.js
    this.bytezClient = new Bytez(apiKey || "");
  }

  /**
   * Получает модель по ID
   * @param modelId ID модели
   * @returns Объект модели bytez.js
   */
  getModel(modelId: string): any {
    if (!modelId) {
      throw new BadRequestException("Model ID is required");
    }
    return this.bytezClient.model(modelId);
  }

  /**
   * Запускает модель с входными данными
   * @param data Данные для запуска модели
   * @returns Результат выполнения модели
   */
  async runModel(data: BytezModelRunDto): Promise<BytezModelResponseDto> {
    try {
      this.logger.debug(
        `Running model ${data.modelId} with input: ${JSON.stringify(data.input).substring(0, 200)}`
      );

      const model = this.getModel(data.modelId);
      const result: any = await model.run({
        input: data.input,
        ...data.options,
      });

      this.logger.debug(`Model ${data.modelId} completed successfully`);

      return {
        output: result.output,
        error: result.error,
        metadata: (result as any).metadata || {},
      };
    } catch (error: any) {
      this.logger.error(
        `Error running model ${data.modelId}: ${error.message}`,
        error.stack
      );
      throw new BadRequestException(
        `Failed to run model: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Получает информацию о модели
   * @param modelId ID модели
   * @returns Информация о модели
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      this.logger.debug(`Getting info for model ${modelId}`);
      const model = this.getModel(modelId);

      // bytez.js может иметь метод для получения информации о модели
      // Если такого метода нет, возвращаем базовую информацию
      return {
        modelId,
        available: true,
      };
    } catch (error: any) {
      this.logger.error(
        `Error getting model info for ${modelId}: ${error.message}`
      );
      throw new BadRequestException(
        `Failed to get model info: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Получает список доступных моделей (если поддерживается API)
   * @param query Поисковый запрос (опционально)
   * @param limit Лимит результатов (опционально)
   * @returns Список моделей
   */
  async listModels(query?: string, limit?: number): Promise<any> {
    try {
      this.logger.debug(`Listing models with query: ${query}, limit: ${limit}`);

      // bytez.js может иметь метод для получения списка моделей
      // Если такого метода нет, возвращаем пустой массив или базовую информацию
      // В реальной реализации здесь должен быть вызов API bytez для получения списка моделей

      return {
        models: [],
        total: 0,
        message:
          "Model listing is not directly supported. Use model ID from bytez.com/model-hub",
      };
    } catch (error: any) {
      this.logger.error(`Error listing models: ${error.message}`);
      throw new BadRequestException(
        `Failed to list models: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Проверяет доступность API ключа
   * @returns true если API ключ установлен
   */
  isApiKeyConfigured(): boolean {
    const bytezConfig = this.configService.get("bytez");
    return !!bytezConfig?.apiKey;
  }
}
