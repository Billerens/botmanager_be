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
import {
  DatabaseService,
  DatabaseQueryConfig,
  DatabaseQueryResult,
} from "../database.service";

@Injectable()
export class DatabaseNodeHandler extends BaseNodeHandler {
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
    private readonly databaseService: DatabaseService
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
    return nodeType === "database";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    if (!currentNode?.data?.database) {
      this.logger.warn("Database configuration not found in node");
      session.variables[`db_${currentNode.nodeId}_error`] =
        "Database configuration not found";
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const dbConfig: DatabaseQueryConfig = currentNode.data.database;

    // Подставляем переменные в конфигурацию
    const processedConfig = this.substituteVariablesInConfig(dbConfig, context);

    this.logger.log(`=== DATABASE УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);
    this.logger.log(
      `Конфигурация: ${JSON.stringify(processedConfig, null, 2)}`
    );

    try {
      const result: DatabaseQueryResult =
        await this.databaseService.executeQuery(bot.id, processedConfig);

      // Сохраняем результаты в переменные сессии
      session.variables[`db_${currentNode.nodeId}_success`] =
        result.success.toString();
      session.variables[`db_${currentNode.nodeId}_count`] =
        result.count?.toString() || "0";

      if (result.success) {
        if (result.data !== undefined) {
          session.variables[`db_${currentNode.nodeId}_result`] = JSON.stringify(
            result.data
          );
        }
        if (result.count !== undefined) {
          session.variables[`db_${currentNode.nodeId}_count`] =
            result.count.toString();
        }

        this.logger.log(
          `Database query successful: ${result.count || 0} records affected`
        );
      } else {
        session.variables[`db_${currentNode.nodeId}_error`] =
          result.error || "Unknown error";
        this.logger.error(`Database query failed: ${result.error}`);
      }

      this.logger.log(
        `Результат сохранен в переменные сессии с префиксом: db_${currentNode.nodeId}_`
      );
    } catch (error) {
      this.logger.error("Critical error in database node:", error);
      session.variables[`db_${currentNode.nodeId}_error`] = error.message;
      session.variables[`db_${currentNode.nodeId}_success`] = "false";
    }

    // Всегда переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }

  private substituteVariablesInConfig(
    config: DatabaseQueryConfig,
    context: FlowContext
  ): DatabaseQueryConfig {
    const processed = { ...config };

    // Подставляем переменные в строковые поля
    if (processed.table) {
      processed.table = this.substituteVariables(processed.table, context);
    }

    if (processed.collection) {
      processed.collection = this.substituteVariables(
        processed.collection,
        context
      );
    }

    if (processed.where) {
      processed.where = this.substituteVariables(processed.where, context);
    }

    if (processed.key) {
      processed.key = this.substituteVariables(processed.key, context);
    }

    if (processed.orderBy) {
      processed.orderBy = this.substituteVariables(processed.orderBy, context);
    }

    // Подставляем переменные в data объекте
    if (processed.data && typeof processed.data === "object") {
      processed.data = this.substituteVariablesInObject(
        processed.data,
        context
      );
    }

    return processed;
  }

  private substituteVariablesInObject(obj: any, context: FlowContext): any {
    if (typeof obj === "string") {
      return this.substituteVariables(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.substituteVariablesInObject(item, context));
    }

    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariablesInObject(value, context);
      }
      return result;
    }

    return obj;
  }
}
