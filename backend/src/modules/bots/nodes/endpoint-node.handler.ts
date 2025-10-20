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
    @Inject(forwardRef(() => FlowExecutionService))
    private readonly flowExecutionService: FlowExecutionService
  ) {
    super(
      botFlowRepository,
      botFlowNodeRepository,
      telegramService,
      botsService,
      logger,
      messagesService
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

    this.logger.log(`=== ENDPOINT УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);
    this.logger.log(`URL: ${url}`);

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
    const endpointUrl = `/api/endpoint/${context.bot.id}/${currentNode.nodeId}/${url}`;
    session.variables[`endpoint_${currentNode.nodeId}_url`] = endpointUrl;
    session.variables[`endpoint_${currentNode.nodeId}_full_url`] =
      `${process.env.BACKEND_URL || "http://localhost:3000"}${endpointUrl}`;
    session.variables[`endpoint_${currentNode.nodeId}_created`] = "true";

    this.logger.log(`Эндпоинт создан: ${endpointUrl}`);
    this.logger.log(
      `Полный URL: ${session.variables[`endpoint_${currentNode.nodeId}_full_url`]}`
    );

    // Проверяем, есть ли данные в глобальном хранилище эндпоинтов
    const storedEndpointData = this.flowExecutionService.getEndpointData(
      context.bot.id,
      currentNode.nodeId
    );

    if (storedEndpointData) {
      this.logger.log(
        `Найдены данные в глобальном хранилище эндпоинта (получено запросов: ${storedEndpointData.requestCount})`
      );

      // Загружаем данные из глобального хранилища в переменные сессии
      Object.assign(session.variables, storedEndpointData.data);

      this.logger.log(
        `Данные из глобального хранилища загружены в сессию пользователя ${session.userId}`
      );
    } else {
      this.logger.log(
        `Данные в глобальном хранилище эндпоинта не найдены. Ожидание запросов на эндпоинт.`
      );
    }

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
