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
    const { name, value, operation } = variableData;

    // Выполняем операцию с переменной
    switch (operation) {
      case "set":
        session.variables[name] = value;
        break;
      case "append":
        session.variables[name] = (session.variables[name] || "") + value;
        break;
      case "prepend":
        session.variables[name] = value + (session.variables[name] || "");
        break;
      case "increment":
        session.variables[name] = (
          parseInt(session.variables[name] || "0") + 1
        ).toString();
        break;
      case "decrement":
        session.variables[name] = (
          parseInt(session.variables[name] || "0") - 1
        ).toString();
        break;
    }

    this.logger.log(`Переменная ${name} = ${session.variables[name]}`);

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
