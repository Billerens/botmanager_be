import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";
import { AiModelSelectorService } from "../services/ai-model-selector.service";
import { LangChainOpenRouterService } from "../../langchain-openrouter/langchain-openrouter.service";
import { MessageRole } from "../../langchain-openrouter/dto/langchain-chat.dto";
import { AiProvidersService } from "../../ai-providers/ai-providers.service";

interface AiSingleNodeData {
  prompt: string;
  outputVariable: string;
  maxTokens?: number;
  temperature?: number;
  /** Предпочтительная модель из списка OpenRouter. Игнорируется если задан aiProviderId. */
  preferredModelId?: string;
  /** ID профиля AI-провайдера. Если задан — используется кастомный провайдер вместо системного OpenRouter. */
  aiProviderId?: string;
}

/**
 * Обработчик узла AI Single Response
 *
 * Выполняет одиночный запрос к AI модели и сохраняет результат
 * в переменную сессии без отправки сообщения пользователю.
 *
 * Приоритет выбора модели:
 * 1. Кастомный провайдер (aiProviderId) — используются URL/ключ из профиля
 * 2. preferredModelId — конкретная модель через системный OpenRouter
 * 3. Автоматический выбор по AiModelSelectorService
 */
@Injectable()
export class AiSingleNodeHandler extends BaseNodeHandler {
  private readonly systemPrompt = `Ты - краткий и точный помощник. Отвечай лаконично и по существу.\nНе добавляй лишних объяснений, приветствий или вступлений, если их не просят.\nДавай прямой ответ на поставленный вопрос или задачу.`;

  constructor(
    @InjectRepository(BotFlow)
    botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    botFlowNodeRepository: Repository<BotFlowNode>,
    telegramService: TelegramService,
    botsService: BotsService,
    logger: CustomLoggerService,
    messagesService: MessagesService,
    activityLogService: ActivityLogService,
    private readonly aiModelSelector: AiModelSelectorService,
    private readonly langChainService: LangChainOpenRouterService,
    private readonly aiProvidersService: AiProvidersService,
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService,
      activityLogService
    );
  }

  canHandle(nodeType: string): boolean {
    return nodeType === "ai_single";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    this.logger.log(`=== AI SINGLE УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    const nodeData = currentNode.data.aiSingle as AiSingleNodeData | undefined;

    if (!nodeData || !nodeData.prompt) {
      this.logger.warn("AI Single: Промпт не задан в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const {
      prompt,
      outputVariable = "ai_response",
      maxTokens = 500,
      temperature = 0.7,
      preferredModelId,
      aiProviderId,
    } = nodeData;

    const processedPrompt = this.substituteVariables(prompt, context);
    this.logger.log(`AI Single: Промпт после подстановки: "${processedPrompt.substring(0, 100)}..."`);

    try {
      // === Ветка 1: Кастомный AI-провайдер ===
      if (aiProviderId?.trim()) {
        this.logger.log(`AI Single: используем кастомный провайдер ${aiProviderId}`);
        const { model, resolvedModel, providerName } =
          await this.aiProvidersService.buildChatOpenAI(
            aiProviderId.trim(),
            context.bot.ownerId,
            {
              modelName: preferredModelId?.trim() || undefined,
              temperature,
              maxTokens,
            },
          );
        this.logger.log(`AI Single: провайдер "${providerName}", модель ${resolvedModel}`);

        const rawResponse = await model.invoke([
          { role: "system", content: this.systemPrompt },
          { role: "user", content: processedPrompt },
        ]);

        const aiResponse =
          typeof rawResponse.content === "string"
            ? rawResponse.content
            : Array.isArray(rawResponse.content)
              ? (rawResponse.content as any[])
                  .map((b) => (typeof b === "string" ? b : b?.text ?? b?.content ?? ""))
                  .join("")
              : String(rawResponse.content ?? "");

        session.variables[outputVariable] = aiResponse;
        session.variables[`${outputVariable}_model`] = resolvedModel;
        session.variables[`${outputVariable}_model_id`] = resolvedModel;
        this.logger.log(`AI Single: ответ сохранён в "${outputVariable}" (${providerName})`);
        
        if (rawResponse.response_metadata && "tokenUsage" in rawResponse.response_metadata) {
          const metadata = rawResponse.response_metadata as any;
          if (metadata.tokenUsage) {
            this.logger.log(
              `AI Single [Custom]: Токены - prompt: ${metadata.tokenUsage.promptTokens}, completion: ${metadata.tokenUsage.completionTokens}`
            );
          }
        }

        await this.moveToNextNode(context, currentNode.nodeId);
        return;
      }

      // === Ветка 2: Системный OpenRouter (стандартное поведение) ===
      const doChat = (modelId: string) =>
        this.langChainService.chat({
          messages: [
            { role: MessageRole.SYSTEM, content: this.systemPrompt },
            { role: MessageRole.HUMAN, content: processedPrompt },
          ],
          model: modelId,
          parameters: { maxTokens, temperature },
        });

      let response: Awaited<ReturnType<typeof doChat>>;
      let modelId: string;
      let modelName: string;

      if (preferredModelId?.trim()) {
        const available = await this.aiModelSelector.getAvailableModels();
        const preferred = available.find((m) => m.id === preferredModelId.trim());
        if (preferred) {
          this.logger.log(`AI Single: Используем выбранную модель ${preferred.id}`);
          response = await doChat(preferred.id);
          modelId = preferred.id;
          modelName = preferred.name;
        } else {
          this.logger.warn(`AI Single: модель "${preferredModelId}" не в списке, выбор автоматический`);
          const fallback = await this.aiModelSelector.executeWithFallback(doChat);
          response = fallback.result;
          modelId = fallback.modelId;
          modelName = fallback.modelName;
        }
      } else {
        const fallback = await this.aiModelSelector.executeWithFallback(doChat);
        response = fallback.result;
        modelId = fallback.modelId;
        modelName = fallback.modelName;
      }

      const aiResponse =
        typeof response.content === "string"
          ? response.content
          : Array.isArray(response.content)
            ? (response.content as { type?: string; text?: string; content?: string }[])
                .map((block) => (typeof block === "string" ? block : block?.text ?? block?.content ?? ""))
                .join("")
            : String(response.content ?? "");

      session.variables[outputVariable] = aiResponse;
      session.variables[`${outputVariable}_model`] = modelName;
      session.variables[`${outputVariable}_model_id`] = modelId;

      this.logger.log(`AI Single: Ответ сохранен в переменную "${outputVariable}"`);
      this.logger.log(`AI Single: Использована модель: ${modelName} (${modelId})`);
      this.logger.log(`AI Single: Длина ответа: ${aiResponse.length} символов`);

      if (response.metadata?.usage) {
        this.logger.log(
          `AI Single: Токены - prompt: ${response.metadata.usage.promptTokens}, completion: ${response.metadata.usage.completionTokens}`
        );
      }
    } catch (error) {
      this.logger.error(`AI Single: Ошибка получения ответа: ${error.message}`);
      session.variables[outputVariable] = "";
      session.variables[`${outputVariable}_error`] = error.message;
    }

    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
