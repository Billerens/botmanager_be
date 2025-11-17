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
export class TransformNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "transform";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session, bot } = context;

    this.logger.log(`=== TRANSFORM УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);

    // Получаем настройки transform из данных узла
    const transformData = (currentNode.data as any)?.transform;

    if (!transformData) {
      this.logger.warn("Настройки transform не заданы в узле");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    const { code, variableName, inputVariable } = transformData;

    if (!code) {
      this.logger.warn("Код для выполнения не задан");
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    try {
      // Создаем объект context с переменными для выполнения кода
      const codeContext = this.buildCodeContext(context, inputVariable);

      this.logger.log(`Исходный код: ${code.substring(0, 100)}...`);
      this.logger.log(
        `Доступные переменные: ${Object.keys(codeContext.variables).join(", ")}`
      );

      // Выполняем код через eval в изолированном контексте
      const result = this.executeCode(code, codeContext);

      this.logger.log(
        `Результат выполнения: ${JSON.stringify(result)} (тип: ${typeof result})`
      );

      // Сохраняем результат в переменную сессии, если указано имя переменной
      if (variableName) {
        // Преобразуем результат в строку, если это объект
        const resultValue =
          typeof result === "object" ? JSON.stringify(result) : String(result);
        session.variables[variableName] = resultValue;

        this.logger.log(
          `Сохранено в переменную ${variableName}: ${resultValue}`
        );
      }

      // Переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error) {
      this.logger.error(
        `Ошибка выполнения кода:`,
        error instanceof Error ? error.message : String(error)
      );
      this.logger.error(
        `Стек ошибки:`,
        error instanceof Error ? error.stack : ""
      );

      // При ошибке все равно переходим к следующему узлу
      await this.moveToNextNode(context, currentNode.nodeId);
    }
  }

  /**
   * Создает контекст для выполнения кода с переменными
   */
  private buildCodeContext(
    context: FlowContext,
    inputVariable?: string
  ): Record<string, any> {
    const { session, bot, flow, currentNode, message } = context;

    // Базовый контекст с основными объектами
    // Парсим переменные из JSON строк, если они хранятся как строки
    const parsedVariables: Record<string, any> = {};
    if (session.variables) {
      for (const [key, value] of Object.entries(session.variables)) {
        if (typeof value === "string") {
          try {
            // Пытаемся распарсить как JSON
            parsedVariables[key] = JSON.parse(value);
          } catch {
            // Если не JSON, оставляем как строку
            parsedVariables[key] = value;
          }
        } else {
          parsedVariables[key] = value;
        }
      }
    }

    const codeContext: Record<string, any> = {
      // Все переменные сессии (с автоматическим парсингом JSON)
      variables: parsedVariables,
      // Информация о пользователе
      user: {
        id: session.userId,
        chatId: session.chatId,
      },
      // Информация о боте
      bot: {
        id: bot.id,
        name: bot.name,
      },
      // Информация о текущем узле
      node: {
        id: currentNode.nodeId,
        type: currentNode.type,
        label: currentNode.data?.label,
      },
      // Текущее сообщение (если есть)
      message: message
        ? {
            text: message.text,
            type: message.type,
            contentType: message.contentType,
          }
        : null,
    };

    // Если указана входная переменная, добавляем её отдельно
    if (inputVariable && session.variables[inputVariable]) {
      try {
        // Пытаемся распарсить JSON, если это объект
        const inputValue = session.variables[inputVariable];
        codeContext.input = this.tryParseJson(inputValue);
      } catch (error) {
        this.logger.warn(
          `Не удалось распарсить входную переменную ${inputVariable}`
        );
        codeContext.input = session.variables[inputVariable];
      }
    }

    return codeContext;
  }

  /**
   * Пытается распарсить строку как JSON, возвращает исходное значение если не удалось
   */
  private tryParseJson(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Безопасное выполнение JavaScript кода через eval
   * ВАЖНО: eval может быть опасным
   */
  private executeCode(code: string, context: Record<string, any>): any {
    try {
      // Создаем функцию с контекстом
      // Используем Function конструктор для более безопасного выполнения
      // (хотя все равно это eval по сути)
      // Оборачиваем код в IIFE, чтобы можно было использовать return
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);

      // Создаем строку с параметрами функции
      const paramsString = contextKeys.join(", ");

      // Создаем тело функции с кодом
      // Всегда оборачиваем код в функцию, чтобы можно было использовать return
      // и чтобы переменные контекста были доступны напрямую
      const functionBody = `
        "use strict";
        try {
          ${code}
        } catch (error) {
          throw new Error("Ошибка выполнения кода: " + error.message);
        }
      `;

      // eslint-disable-next-line no-new-func
      const func = new Function(paramsString, functionBody);

      // Выполняем функцию с переданным контекстом
      const result = func(...contextValues);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(`Детали ошибки выполнения кода: ${errorMessage}`);
      if (errorStack) {
        this.logger.error(`Стек ошибки: ${errorStack}`);
      }
      throw new Error(`Ошибка выполнения JavaScript кода: ${errorMessage}`);
    }
  }
}
