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
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class CalculatorNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "calculator";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    this.logger.log(`=== CALCULATOR УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    // Получаем настройки калькулятора из данных узла
    const calculatorData = currentNode.data.calculator;

    if (!calculatorData) {
      this.logger.warn("Настройки калькулятора не заданы в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const {
      expression,
      variableName,
      precision = 2,
      format = "number",
    } = calculatorData;

    if (!expression || !variableName) {
      this.logger.warn("Выражение или имя переменной не заданы");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    try {
      // Подставляем переменные в выражение
      const processedExpression = this.substituteVariables(expression, context);

      this.logger.log(`Исходное выражение: ${expression}`);
      this.logger.log(`Обработанное выражение: ${processedExpression}`);

      // Вычисляем результат
      const result = this.evaluateExpression(processedExpression);

      this.logger.log(`Результат вычисления: ${result}`);

      // Форматируем результат
      const formattedResult = this.formatResult(result, precision, format);

      // Сохраняем результат в переменную сессии
      session.variables[variableName] = formattedResult;

      this.logger.log(
        `Сохранено в переменную ${variableName}: ${formattedResult}`
      );

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error) {
      this.logger.error(`Ошибка вычисления выражения "${expression}":`, error);

      // При ошибке все равно переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    }
  }

  /**
   * Безопасное вычисление математического выражения
   */
  private evaluateExpression(expression: string): number {
    // Заменяем математические операторы для безопасности
    const sanitizedExpression = expression
      .replace(/[^0-9+\-*/().\s]/g, "") // Разрешаем только цифры, операторы и скобки
      .replace(/\s+/g, ""); // Убираем пробелы

    // Используем Function конструктор для безопасного вычисления
    // (более безопасно чем eval)
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(
        `"use strict"; return (${sanitizedExpression})`
      )();
      return Number(result);
    } catch (error) {
      throw new Error(`Неверное математическое выражение: ${expression}`);
    }
  }

  /**
   * Форматирование результата
   */
  private formatResult(
    value: number,
    precision: number,
    format: string
  ): string {
    switch (format) {
      case "currency":
        return value.toLocaleString("ru-RU", {
          style: "currency",
          currency: "RUB",
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        });
      case "percentage":
        return `${(value * 100).toFixed(precision)}%`;
      case "number":
      default:
        return value.toFixed(precision);
    }
  }
}
