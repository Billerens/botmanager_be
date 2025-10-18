import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import {
  BotFlowNode,
  ConditionOperator,
} from "../../../database/entities/bot-flow-node.entity";
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

    // Подставляем переменные в значение условия
    const conditionValue = this.substituteVariables(
      condition.value || "",
      context
    );

    this.logger.log(`=== CONDITION УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${context.session.userId}`);
    this.logger.log(`Оператор: ${condition.operator}`);
    this.logger.log(`Исходное значение условия: "${condition.value}"`);
    this.logger.log(`Обработанное значение условия: "${conditionValue}"`);
    this.logger.log(`Вход пользователя: "${userInput}"`);

    let conditionMet = false;

    switch (condition.operator) {
      case "equals":
        conditionMet = userInput === conditionValue;
        break;
      case "contains":
        conditionMet = userInput
          .toLowerCase()
          .includes(conditionValue.toLowerCase());
        break;
      case "startsWith":
        conditionMet = userInput
          .toLowerCase()
          .startsWith(conditionValue.toLowerCase());
        break;
      case ConditionOperator.VARIABLE_EQUALS:
        // Сравнение с переменной сессии
        const variableValue = context.session.variables[conditionValue] || "";
        conditionMet = userInput === variableValue;
        this.logger.log(
          `Сравнение с переменной ${conditionValue} = "${variableValue}"`
        );
        break;
      case ConditionOperator.VARIABLE_CONTAINS:
        // Проверка содержимого переменной
        const varValue = context.session.variables[conditionValue] || "";
        conditionMet = varValue.toLowerCase().includes(userInput.toLowerCase());
        this.logger.log(
          `Проверка переменной ${conditionValue} = "${varValue}" содержит "${userInput}"`
        );
        break;
      default:
        this.logger.warn(`Неизвестный оператор условия: ${condition.operator}`);
    }

    this.logger.log(`Результат условия: ${conditionMet ? "TRUE" : "FALSE"}`);

    // Переходим к следующему узлу (в реальной реализации можно добавить trueNodeId/falseNodeId)
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
