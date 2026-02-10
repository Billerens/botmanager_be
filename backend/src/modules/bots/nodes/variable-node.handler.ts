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
export class VariableNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "variable";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    this.logger.log(`=== VARIABLE УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    const variables = currentNode.data.variables || {};

    if (!variables || Object.keys(variables).length === 0) {
      this.logger.warn("Переменные не заданы в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    this.logger.log(`Устанавливаем переменные: ${JSON.stringify(variables)}`);

    // Устанавливаем все переменные
    for (const [key, value] of Object.entries(variables)) {
      // Подставляем переменные в значение
      const processedValue = this.substituteVariables(value as string, context);

      // Сохраняем в сессию
      session.variables[key] = processedValue;

      this.logger.log(`Установлена переменная: ${key} = "${processedValue}"`);
    }

    this.logger.log(
      `Обновлено ${Object.keys(variables).length} переменных. Всего в сессии: ${Object.keys(session.variables).length}`
    );

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
