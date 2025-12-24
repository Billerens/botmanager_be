import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";
import { FlowExecutionService } from "../flow-execution.service";
import { ActivityLogService } from "../../activity-log/activity-log.service";

@Injectable()
export class EndpointNodeHandler extends BaseNodeHandler {
  constructor(
    @InjectRepository(BotFlow)
    protected readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    protected readonly botFlowNodeRepository: Repository<BotFlowNode>,
    protected readonly telegramService: TelegramService,
    protected readonly botsService: BotsService,
    protected readonly logger: CustomLoggerService,
    protected readonly messagesService: MessagesService,
    protected readonly activityLogService: ActivityLogService,
    @Inject(forwardRef(() => FlowExecutionService))
    private readonly flowExecutionService: FlowExecutionService
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
    return nodeType === "endpoint";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.endpoint) {
      this.logger.warn("Данные endpoint не найдены");
      return;
    }

    const endpointConfig = currentNode.data.endpoint;
    const { url, accessKey } = endpointConfig;

    // ВАЖНО: Устанавливаем currentNodeId на эту ноду, чтобы flow знал, где мы находимся
    // Это необходимо, т.к. мы можем остановиться здесь в ожидании данных
    session.currentNodeId = currentNode.nodeId;
    session.lastActivity = new Date();

    // Проверка обязательных полей
    if (!url || url.trim() === "") {
      this.logger.error("URL эндпоинта не задан");
      session.variables[`endpoint_${currentNode.nodeId}_error`] =
        "URL не задан";
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    if (!accessKey || accessKey.trim() === "") {
      this.logger.error("Access Key не задан");
      session.variables[`endpoint_${currentNode.nodeId}_error`] =
        "Access Key не задан";
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    // Сохраняем информацию об эндпоинте в переменные сессии
    const endpointUrl = `/endpoint/${context.bot.id}/${currentNode.nodeId}/${url}`;
    session.variables[`endpoint_${currentNode.nodeId}_url`] = endpointUrl;
    session.variables[`endpoint_${currentNode.nodeId}_full_url`] =
      `${process.env.BACKEND_URL || "http://localhost:3000"}${endpointUrl}`;
    session.variables[`endpoint_${currentNode.nodeId}_created`] = "true";

    // Проверяем, есть ли данные в глобальном хранилище эндпоинтов
    const storedEndpointData = this.flowExecutionService.getEndpointData(
      context.bot.id,
      currentNode.nodeId
    );

    if (storedEndpointData) {
      // Загружаем данные из глобального хранилища в переменные сессии
      Object.assign(session.variables, storedEndpointData.data);

      // Переходим к следующему узлу только если данные уже есть
      await this.moveToNextNode(context, currentNode.nodeId);
    } else {
      // Отправляем пользователю информацию об ожидании данных
      const waitingMessage =
        currentNode.data?.endpoint?.waitingMessage ||
        `⏳ Ожидание данных...\n\nОтправьте POST запрос на эндпоинт:\n<code>${endpointUrl}</code>\n\nВаш User ID: <code>${session.userId}</code>`;

      try {
        // Отправляем сообщение с поддержкой длинных текстов
        await this.sendAndSaveMessage(
          context.bot,
          context.message.chat.id.toString(),
          waitingMessage,
          { parse_mode: "HTML" }
        );
      } catch (error) {
        // Ошибка отправки не критична
      }

      // НЕ переходим к следующему узлу - flow остановлен и ждет данных
      // Когда придет POST запрос, EndpointController продолжит выполнение
    }
  }
}
