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
export class IntegrationNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "integration";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.integration) {
      this.logger.warn("Данные интеграции не найдены");
      return;
    }

    const integrationData = currentNode.data.integration;
    const { service, action, config } = integrationData;

    try {
      this.logger.log(`Выполняем интеграцию: ${service}.${action}`);

      // Здесь можно добавить логику для различных сервисов
      switch (service) {
        case "crm":
          this.logger.log("Интеграция с CRM системой");
          break;
        case "email":
          this.logger.log("Интеграция с email сервисом");
          break;
        case "analytics":
          this.logger.log("Интеграция с аналитикой");
          break;
        case "payment":
          this.logger.log("Интеграция с платежной системой");
          break;
        case "custom":
          this.logger.log("Кастомная интеграция");
          break;
        default:
          this.logger.warn(`Неизвестный сервис интеграции: ${service}`);
      }

      this.logger.log(`Конфигурация интеграции: ${JSON.stringify(config)}`);

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error) {
      this.logger.error("Ошибка выполнения интеграции:", error);
    }
  }
}
