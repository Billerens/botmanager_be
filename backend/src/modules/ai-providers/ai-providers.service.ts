import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChatOpenAI } from "@langchain/openai";
import { AiProvider } from "../../database/entities/ai-provider.entity";
import { CreateAiProviderDto } from "./dto/create-ai-provider.dto";
import { UpdateAiProviderDto } from "./dto/update-ai-provider.dto";
import { AiProviderResponseDto } from "./dto/ai-provider-response.dto";
import { encryptSecret, decryptSecret } from "../../common/crypto.util";

// TODO: Интеграция с ИИ-агентами (LangChain AgentExecutor) — будущая итерация.
// Профили провайдеров можно будет использовать не только в Bot Flow узлах,
// но и для конфигурирования агентов в модуле langchain-openrouter.

@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);

  constructor(
    @InjectRepository(AiProvider)
    private readonly repo: Repository<AiProvider>,
  ) {}

  private toResponseDto(provider: AiProvider): AiProviderResponseDto {
    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      description: provider.description ?? null,
      baseUrl: provider.baseUrl ?? null,
      defaultModel: provider.defaultModel ?? null,
      isActive: provider.isActive,
      hasApiKey: !!provider.apiKey,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  async findAll(userId: string): Promise<AiProviderResponseDto[]> {
    const providers = await this.repo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
    return providers.map((p) => this.toResponseDto(p));
  }

  async findOne(id: string, userId: string): Promise<AiProviderResponseDto> {
    const provider = await this.repo.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException("AI провайдер не найден");
    }
    if (provider.userId !== userId) {
      throw new ForbiddenException("Нет доступа к этому провайдеру");
    }
    return this.toResponseDto(provider);
  }

  async create(
    userId: string,
    dto: CreateAiProviderDto,
  ): Promise<AiProviderResponseDto> {
    const provider = this.repo.create({
      ...dto,
      userId,
      apiKey: dto.apiKey ? encryptSecret(dto.apiKey) : null,
    });
    const saved = await this.repo.save(provider);
    this.logger.log(`Создан AI провайдер "${saved.name}" (${saved.id}) для пользователя ${userId}`);
    return this.toResponseDto(saved);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAiProviderDto,
  ): Promise<AiProviderResponseDto> {
    const provider = await this.repo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException("AI провайдер не найден");
    if (provider.userId !== userId) throw new ForbiddenException("Нет доступа");

    const { apiKey, ...rest } = dto;
    Object.assign(provider, rest);

    // Обновляем ключ только если он явно передан (не undefined)
    if (apiKey !== undefined) {
      provider.apiKey = apiKey ? encryptSecret(apiKey) : null;
    }

    const saved = await this.repo.save(provider);
    return this.toResponseDto(saved);
  }

  async remove(id: string, userId: string): Promise<void> {
    const provider = await this.repo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException("AI провайдер не найден");
    if (provider.userId !== userId) throw new ForbiddenException("Нет доступа");
    await this.repo.remove(provider);
    this.logger.log(`Удалён AI провайдер "${provider.name}" (${id})`);
  }

  /**
   * Создаёт экземпляр ChatOpenAI с настройками из профиля провайдера.
   * Используется в AiSingleNodeHandler и AiChatNodeHandler.
   *
   * @param providerId - ID профиля провайдера
   * @param userId - ID владельца (для проверки доступа)
   * @param parameters - override-параметры (temperature, maxTokens, modelName)
   *
   * TODO: Добавить поддержку image generation через отдельный метод
   * (потребует иного API-пути /images/generations, несовместимого с ChatOpenAI).
   */
  async buildChatOpenAI(
    providerId: string,
    userId: string,
    parameters?: {
      modelName?: string; // переопределяет defaultModel профиля
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    },
  ): Promise<{ model: ChatOpenAI; providerName: string; resolvedModel: string }> {
    const provider = await this.repo.findOne({ where: { id: providerId } });
    if (!provider) throw new NotFoundException("AI провайдер не найден");
    if (provider.userId !== userId) throw new ForbiddenException("Нет доступа к провайдеру");
    if (!provider.isActive) {
      throw new BadRequestException(`Провайдер "${provider.name}" неактивен`);
    }
    if (!provider.apiKey) {
      throw new BadRequestException(`У провайдера "${provider.name}" не задан API-ключ`);
    }

    const decryptedKey = decryptSecret(provider.apiKey);
    const resolvedModel = parameters?.modelName || provider.defaultModel;

    if (!resolvedModel) {
      throw new BadRequestException(
        `У провайдера "${provider.name}" не задана модель. Укажите defaultModel в профиле или preferredModelId в узле.`,
      );
    }

    const configuration: any = {};
    if (provider.baseUrl) {
      configuration.baseURL = provider.baseUrl;
    }

    const model = new ChatOpenAI({
      modelName: resolvedModel,
      openAIApiKey: decryptedKey,
      temperature: parameters?.temperature ?? 0.7,
      maxTokens: parameters?.maxTokens ?? 4000,
      topP: parameters?.topP,
      frequencyPenalty: parameters?.frequencyPenalty,
      presencePenalty: parameters?.presencePenalty,
      configuration,
    });

    return {
      model,
      providerName: provider.name,
      resolvedModel,
    };
  }

  /**
   * Выполняет тестовый запрос к провайдеру.
   * Отправляет простой "ping" и проверяет, есть ли ответ.
   */
  async testConnection(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; model?: string }> {
    try {
      const { model, resolvedModel } = await this.buildChatOpenAI(id, userId, {
        maxTokens: 10,
        temperature: 0,
      });

      const response = await model.invoke([
        { role: "user", content: "Reply with just: OK" },
      ]);

      return {
        success: true,
        message: "Подключение успешно",
        model: resolvedModel,
      };
    } catch (error) {
      this.logger.warn(`Тест подключения провайдера ${id} не прошёл: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
