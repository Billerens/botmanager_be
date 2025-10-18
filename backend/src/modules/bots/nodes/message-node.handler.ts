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
export class MessageNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "message";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, message } = context;

    const messageText = currentNode.data?.text || "Привет!";
    const parseMode = currentNode.data?.parseMode || "HTML";

    // Отправляем сообщение и сохраняем в БД
    await this.sendAndSaveMessage(bot, message.chat.id, messageText, {
      parse_mode: parseMode,
    });

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
