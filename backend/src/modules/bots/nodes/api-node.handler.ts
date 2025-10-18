import { Injectable } from "@nestjs/common";
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

@Injectable()
export class ApiNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "api";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode } = context;

    // Простая реализация API узла (можно расширить)
    const apiConfig = currentNode.data?.webhook;
    if (!apiConfig) {
      this.logger.warn("API конфигурация не задана в узле");
      return;
    }

    try {
      // Здесь можно добавить HTTP запрос
      this.logger.log(`Выполняем API запрос: ${apiConfig.url}`);

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error) {
      this.logger.error("Ошибка выполнения API узла:", error);
    }
  }
}
