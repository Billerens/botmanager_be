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
export class FileNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "file";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, bot, session } = context;

    if (!currentNode?.data?.file) {
      this.logger.warn("Данные файла не найдены");
      return;
    }

    const fileData = currentNode.data.file;

    try {
      switch (fileData.type) {
        case "upload":
          await this.sendAndSaveMessage(
            bot,
            session.chatId,
            `📁 Пожалуйста, загрузите файл.\nРазрешенные типы: ${fileData.accept?.join(", ")}\nМаксимальный размер: ${fileData.maxSize}МБ`
          );
          break;
        case "download":
        case "send":
          if (fileData.url) {
            await this.sendAndSaveDocument(bot, session.chatId, fileData.url, {
              caption: fileData.filename || "file",
            });
          } else {
            await this.sendAndSaveMessage(
              bot,
              session.chatId,
              "📁 Файл не найден"
            );
          }
          break;
        default:
          await this.sendAndSaveMessage(
            bot,
            session.chatId,
            "📁 Неизвестный тип файла"
          );
      }
    } catch (error) {
      this.logger.error("Ошибка работы с файлом:", error);
      await this.sendAndSaveMessage(
        bot,
        session.chatId,
        "❌ Произошла ошибка при работе с файлом"
      );
    }

    // Переходим к следующему узлу
    await this.moveToNextNode(context, currentNode.nodeId);
  }
}
