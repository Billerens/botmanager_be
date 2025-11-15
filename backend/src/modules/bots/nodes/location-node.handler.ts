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
import {
  MessageType,
  MessageContentType,
} from "../../../database/entities/message.entity";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class LocationNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "location";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot, message } = context;

    this.logger.log(`=== LOCATION УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    // Получаем настройки геолокации из данных узла
    const locationData = (currentNode.data as any)?.location;

    if (!locationData) {
      this.logger.warn("Настройки геолокации не заданы в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const {
      requestText = "Пожалуйста, поделитесь своей геолокацией",
      timeout = 300,
      variableName = "userLocation",
      successMessage,
      errorMessage = "Не удалось получить геолокацию. Попробуйте еще раз.",
    } = locationData;

    // Проверяем, если уже получили геолокацию в текущей сессии
    if (
      session.locationRequest &&
      session.locationRequest.nodeId === currentNode.nodeId
    ) {
      // Это ответ на наш запрос геолокации
      await this.handleLocationResponse(
        context,
        session,
        variableName,
        successMessage,
        errorMessage
      );
      return;
    }

    // Отправляем запрос геолокации
    await this.requestLocation(
      context,
      requestText,
      timeout,
      currentNode.nodeId
    );
  }

  private async requestLocation(
    context: FlowContext,
    requestText: string,
    timeout: number,
    nodeId: string
  ): Promise<void> {
    const { bot, session } = context;

    try {
      // Создаем клавиатуру с кнопкой запроса геолокации
      const keyboard = {
        keyboard: [
          [
            {
              text: "📍 Отправить геолокацию",
              request_location: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      };

      // Отправляем сообщение с запросом геолокации
      await this.sendAndSaveMessage(bot, session.userId, requestText, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      // Сохраняем информацию о запросе в сессии
      session.locationRequest = {
        nodeId,
        timestamp: new Date(),
        timeout: timeout * 1000, // конвертируем в миллисекунды
      };

      this.logger.log(
        `Отправлен запрос геолокации пользователю ${session.userId}`
      );
    } catch (error) {
      this.logger.error("Ошибка отправки запроса геолокации:", error);

      // Переходим к следующему узлу при ошибке
      await this.moveToNextNode(context, nodeId);
    }
  }

  private async handleLocationResponse(
    context: FlowContext,
    session: any,
    variableName: string,
    successMessage?: string,
    errorMessage?: string
  ): Promise<void> {
    const { currentNode, bot, message } = context;

    try {
      // Проверяем, есть ли геолокация в сообщении
      if (message.location) {
        // Геолокация получена успешно
        const location = {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          timestamp: new Date(),
        };

        // Сохраняем координаты в переменную сессии
        session.variables[variableName] = JSON.stringify(location);

        this.logger.log(`Геолокация получена: ${JSON.stringify(location)}`);
        this.logger.log(`Сохранено в переменную: ${variableName}`);

        // Отправляем сообщение об успехе, если указано
        if (successMessage) {
          await this.sendAndSaveMessage(bot, session.userId, successMessage);
        }

        // Очищаем информацию о запросе
        delete session.locationRequest;

        // Переходим к следующему узлу
        await this.moveToNextNode(context, currentNode.nodeId);
      } else {
        // Геолокация не получена - ошибка или отказ пользователя
        this.logger.warn(
          `Геолокация не получена от пользователя ${session.userId}`
        );

        // Отправляем сообщение об ошибке
        if (errorMessage) {
          await this.sendAndSaveMessage(bot, session.userId, errorMessage);
        }

        // Очищаем информацию о запросе
        delete session.locationRequest;

        // Переходим к следующему узлу (можно добавить обработку ошибок)
        await this.moveToNextNode(context, currentNode.nodeId);
      }
    } catch (error) {
      this.logger.error("Ошибка обработки ответа геолокации:", error);

      // Очищаем информацию о запросе
      delete session.locationRequest;

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    }
  }
}
