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

    if (!currentNode?.data?.variable) {
      this.logger.warn("Данные переменной не найдены");
      return;
    }

    const variableData = currentNode.data.variable;
    const { name, value, operation, scope } = variableData;

    // Валидация данных
    if (!name || name.trim() === "") {
      this.logger.warn("Имя переменной не задано");
      return;
    }

    // Валидация имени переменной (только буквы, цифры, подчеркивания)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      this.logger.warn(
        `Некорректное имя переменной: ${name}. Используйте только буквы, цифры и подчеркивания`
      );
      return;
    }

    this.logger.log(`=== VARIABLE УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);
    this.logger.log(`Переменная: ${name}`);
    this.logger.log(`Операция: ${operation}`);
    this.logger.log(`Область видимости: ${scope}`);
    this.logger.log(`Значение: ${value}`);

    // Получаем текущее значение переменной в зависимости от области видимости
    let currentValue: string;
    switch (scope) {
      case "user":
        // TODO: Реализовать хранение пользовательских переменных
        this.logger.warn(
          "Область видимости 'user' пока не реализована, используем 'session'"
        );
        currentValue = session.variables[name] || "";
        break;
      case "global":
        // TODO: Реализовать хранение глобальных переменных
        this.logger.warn(
          "Область видимости 'global' пока не реализована, используем 'session'"
        );
        currentValue = session.variables[name] || "";
        break;
      case "session":
      default:
        currentValue = session.variables[name] || "";
        break;
    }

    this.logger.log(`Текущее значение: "${currentValue}"`);

    // Выполняем операцию с переменной
    let newValue: string;
    switch (operation) {
      case "set":
        newValue = value || "";
        break;
      case "append":
        newValue = currentValue + (value || "");
        break;
      case "prepend":
        newValue = (value || "") + currentValue;
        break;
      case "increment":
        const currentNum = parseFloat(currentValue) || 0;
        newValue = (currentNum + 1).toString();
        this.logger.log(`Увеличиваем ${currentNum} на 1 = ${newValue}`);
        break;
      case "decrement":
        const currentNumDec = parseFloat(currentValue) || 0;
        newValue = (currentNumDec - 1).toString();
        this.logger.log(`Уменьшаем ${currentNumDec} на 1 = ${newValue}`);
        break;
      default:
        this.logger.warn(`Неизвестная операция: ${operation}`);
        return;
    }

    // Сохраняем новое значение в зависимости от области видимости
    switch (scope) {
      case "user":
        // TODO: Реализовать хранение пользовательских переменных
        session.variables[name] = newValue;
        break;
      case "global":
        // TODO: Реализовать хранение глобальных переменных
        session.variables[name] = newValue;
        break;
      case "session":
      default:
        session.variables[name] = newValue;
        break;
    }

    this.logger.log(`Новое значение: "${newValue}"`);
    this.logger.log(`Переменная ${name} = ${newValue}`);

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
