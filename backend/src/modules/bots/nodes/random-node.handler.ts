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
export class RandomNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "random";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.random) {
      this.logger.warn("Данные случайного выбора не найдены");
      return;
    }

    const randomData = currentNode.data.random;
    const { options, variable } = randomData;

    // Валидация данных
    if (!options || options.length === 0) {
      this.logger.warn("Нет вариантов для случайного выбора");
      return;
    }

    if (!variable || variable.trim() === "") {
      this.logger.warn("Не задана переменная для сохранения результата");
      return;
    }

    // Фильтруем валидные опции (с положительными весами)
    const validOptions = options.filter(
      (option) =>
        option.value && option.value.trim() !== "" && (option.weight || 1) > 0
    );

    if (validOptions.length === 0) {
      this.logger.warn("Нет валидных вариантов для случайного выбора");
      return;
    }

    // Вычисляем общий вес
    const totalWeight = validOptions.reduce(
      (sum, option) => sum + (option.weight || 1),
      0
    );

    if (totalWeight <= 0) {
      this.logger.warn("Общий вес вариантов должен быть больше 0");
      return;
    }

    // Генерируем случайное число
    const random = Math.random() * totalWeight;

    // Выбираем вариант
    let currentWeight = 0;
    let selectedOption = validOptions[0];

    for (const option of validOptions) {
      currentWeight += option.weight || 1;
      if (random <= currentWeight) {
        selectedOption = option;
        break;
      }
    }

    // Сохраняем результат в переменную (пока только в session)
    session.variables[variable] = selectedOption.value;

    this.logger.log(`=== RANDOM УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);
    this.logger.log(`Вариантов: ${validOptions.length}`);
    this.logger.log(`Общий вес: ${totalWeight}`);
    this.logger.log(`Случайное число: ${random.toFixed(3)}`);
    this.logger.log(
      `Выбранный вариант: ${selectedOption.value} (${selectedOption.label || "без названия"})`
    );
    this.logger.log(`Переменная: ${variable} = ${selectedOption.value}`);

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
