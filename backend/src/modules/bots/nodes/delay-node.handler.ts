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
export class DelayNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "delay";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode } = context;

    if (!currentNode?.data?.delay) {
      this.logger.warn("Данные задержки не найдены");
      return;
    }

    const delayData = currentNode.data.delay;
    let delayMs = delayData.value;

    // Конвертируем в миллисекунды
    switch (delayData.unit) {
      case "seconds":
        delayMs *= 1000;
        break;
      case "minutes":
        delayMs *= 60 * 1000;
        break;
      case "hours":
        delayMs *= 60 * 60 * 1000;
        break;
      case "days":
        delayMs *= 24 * 60 * 60 * 1000;
        break;
    }

    this.logger.log(`Задержка на ${delayMs}мс`);

    // Ждем указанное время
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
