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

/**
 * Структура данных узла AI Single Response
 */
interface AiSingleNodeData {
  prompt: string; // Промпт (поддержка {{variables}})
  outputVariable: string; // Куда сохранить ответ
  maxTokens?: number; // Лимит токенов ответа (default: 500)
  temperature?: number; // Температура (default: 0.7)
}

/**
 * Обработчик узла AI Single Response
 *
 * Выполняет одиночный запрос к AI модели и сохраняет результат
 * в переменную сессии без отправки сообщения пользователю.
 */
@Injectable()
export class AiSingleNodeHandler extends BaseNodeHandler {
  // Системный промпт для лаконичных ответов
  private readonly systemPrompt = `Ты - краткий и точный помощник. Отвечай лаконично и по существу.
Не добавляй лишних объяснений, приветствий или вступлений, если их не просят.
Давай прямой ответ на поставленный вопрос или задачу.`;

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
    private readonly langChainService: LangChainOpenRouterService
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

    const nodeData = currentNode.data.aiSingle;

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
    } = nodeData;

    // Подставляем переменные в промпт
    const processedPrompt = this.substituteVariables(prompt, context);

    this.logger.log(
      `AI Single: Промпт после подстановки: "${processedPrompt.substring(0, 100)}..."`
    );
    this.logger.log(`AI Single: Выходная переменная: ${outputVariable}`);

    try {
      // Получаем ответ от AI с автоматическим fallback
      const {
        result: response,
        modelId,
        modelName,
      } = await this.aiModelSelector.executeWithFallback(async (modelId) => {
        this.logger.log(`AI Single: Используем модель ${modelId}`);

        return this.langChainService.chat({
          messages: [
            {
              role: MessageRole.SYSTEM,
              content: this.systemPrompt,
            },
            {
              role: MessageRole.HUMAN,
              content: processedPrompt,
            },
          ],
          model: modelId,
          parameters: {
            maxTokens,
            temperature,
          },
        });
      });

      // Извлекаем текст: content может быть строкой или массивом (multimodal)
      const aiResponse = typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? (response.content as { type?: string; text?: string; content?: string }[])
              .map((block) => (typeof block === "string" ? block : block?.text ?? block?.content ?? ""))
              .join("")
          : String(response.content ?? "");
      session.variables[outputVariable] = aiResponse;
      session.variables[`${outputVariable}_model`] = modelName;
      session.variables[`${outputVariable}_model_id`] = modelId;

      this.logger.log(
        `AI Single: Ответ сохранен в переменную "${outputVariable}"`
      );
      this.logger.log(
        `AI Single: Использована модель: ${modelName} (${modelId})`
      );
      this.logger.log(`AI Single: Длина ответа: ${aiResponse.length} символов`);

      if (response.metadata?.usage) {
        this.logger.log(
          `AI Single: Токены - prompt: ${response.metadata.usage.promptTokens}, completion: ${response.metadata.usage.completionTokens}`
        );
      }
    } catch (error) {
      this.logger.error(`AI Single: Ошибка получения ответа: ${error.message}`);

      // Сохраняем пустую строку или сообщение об ошибке
      session.variables[outputVariable] = "";
      session.variables[`${outputVariable}_error`] = error.message;
    }

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
