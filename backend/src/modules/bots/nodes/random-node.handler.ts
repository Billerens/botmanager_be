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

    if (!options || options.length === 0) {
      this.logger.warn("Нет вариантов для случайного выбора");
      return;
    }

    // Вычисляем общий вес
    const totalWeight = options.reduce(
      (sum, option) => sum + (option.weight || 1),
      0
    );

    // Генерируем случайное число
    const random = Math.random() * totalWeight;

    // Выбираем вариант
    let currentWeight = 0;
    let selectedOption = options[0];

    for (const option of options) {
      currentWeight += option.weight || 1;
      if (random <= currentWeight) {
        selectedOption = option;
        break;
      }
    }

    // Сохраняем результат в переменную
    if (variable) {
      session.variables[variable] = selectedOption.value;
    }

    this.logger.log(`Случайный выбор: ${selectedOption.value}`);

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
