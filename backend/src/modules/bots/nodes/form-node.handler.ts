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
export class FormNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "form";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, session } = context;

    if (!currentNode?.data?.form) {
      this.logger.warn("Данные формы не найдены");
      return;
    }

    const formData = currentNode.data.form;

    // Отправляем сообщение с формой
    const formMessage = `📝 ${formData.fields
      .map((field) => `${field.label}${field.required ? " *" : ""}`)
      .join("\n")}\n\n${formData.submitText}`;

    await this.sendAndSaveMessage(bot, session.chatId, formMessage);

    // Создаем клавиатуру для отправки формы
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: formData.submitText,
            callback_data: `form_submit_${currentNode.nodeId}`,
          },
        ],
      ],
    };

    await this.sendAndSaveMessage(
      bot,
      session.chatId,
      "Нажмите кнопку для отправки формы:",
      { reply_markup: keyboard }
    );

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
