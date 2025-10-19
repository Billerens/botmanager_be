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

    // Отладочные логи для condition ноды
    this.logger.log(
      `[CONDITION] Узел: ${currentNode.nodeId}, Оператор: ${condition.operator}`
    );
    this.logger.log(
      `[CONDITION] Поле: "${condition.field}", Значение: "${conditionValue}", Ввод: "${userInput}"`
    );

    let conditionMet = false;

    switch (condition.operator) {
      case "equals":
        conditionMet = userInput === conditionValue;
        break;
      case "contains":
        if (condition.caseSensitive) {
          conditionMet = userInput.includes(conditionValue);
        } else {
          conditionMet = userInput
            .toLowerCase()
            .includes(conditionValue.toLowerCase());
        }
        break;
      case "startsWith":
        if (condition.caseSensitive) {
          conditionMet = userInput.startsWith(conditionValue);
        } else {
          conditionMet = userInput
            .toLowerCase()
            .startsWith(conditionValue.toLowerCase());
        }
        break;
      case "endsWith":
        if (condition.caseSensitive) {
          conditionMet = userInput.endsWith(conditionValue);
        } else {
          conditionMet = userInput
            .toLowerCase()
            .endsWith(conditionValue.toLowerCase());
        }
        break;
      case "regex":
        try {
          const regex = new RegExp(
            conditionValue,
            condition.caseSensitive ? "" : "i"
          );
          conditionMet = regex.test(userInput);
        } catch (error) {
          this.logger.warn(`Неверное регулярное выражение: ${conditionValue}`);
          conditionMet = false;
        }
        break;
      case "greaterThan":
        const num1 = parseFloat(userInput);
        const num2 = parseFloat(conditionValue);
        conditionMet = !isNaN(num1) && !isNaN(num2) && num1 > num2;
        break;
      case "lessThan":
        const num3 = parseFloat(userInput);
        const num4 = parseFloat(conditionValue);
        conditionMet = !isNaN(num3) && !isNaN(num4) && num3 < num4;
        break;
      case "isEmpty":
        conditionMet = !userInput || userInput.trim() === "";
        break;
      case "isNotEmpty":
        conditionMet = userInput && userInput.trim() !== "";
        break;
      case ConditionOperator.VARIABLE_EQUALS:
        // Сравнение с переменной сессии
        const variableValue = context.session.variables[conditionValue] || "";
        conditionMet = userInput === variableValue;
        break;
      case ConditionOperator.VARIABLE_CONTAINS:
        // Проверка содержимого переменной
        const varValue = context.session.variables[conditionValue] || "";
        conditionMet = varValue.toLowerCase().includes(userInput.toLowerCase());
        break;
      default:
        this.logger.warn(`Неизвестный оператор условия: ${condition.operator}`);
    }

    this.logger.log(
      `[CONDITION] Результат: ${conditionMet ? "TRUE" : "FALSE"}`
    );

    // Переходим к соответствующему узлу в зависимости от результата
    if (conditionMet) {
      this.logger.log(`[CONDITION] Переход по TRUE выходу`);
      await this.moveToNextNode(context, currentNode.nodeId, "true");
    } else {
      this.logger.log(`[CONDITION] Переход по FALSE выходу`);
      await this.moveToNextNode(context, currentNode.nodeId, "false");
    }
  }
}
