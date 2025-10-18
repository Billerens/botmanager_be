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
export class ConditionNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "condition";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, message } = context;

    // Простая логика условий (можно расширить)
    const condition = currentNode.data?.condition;
    if (!condition) {
      this.logger.warn("Условие не задано в узле");
      return;
    }

    const userInput = message.text || "";
    let conditionMet = false;

    switch (condition.operator) {
      case "equals":
        conditionMet = userInput === condition.value;
        break;
      case "contains":
        conditionMet = userInput
          .toLowerCase()
          .includes(condition.value.toLowerCase());
        break;
      case "startsWith":
        conditionMet = userInput
          .toLowerCase()
          .startsWith(condition.value.toLowerCase());
        break;
      default:
        this.logger.warn(`Неизвестный оператор условия: ${condition.operator}`);
    }

    // Переходим к следующему узлу (в реальной реализации можно добавить trueNodeId/falseNodeId)
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
