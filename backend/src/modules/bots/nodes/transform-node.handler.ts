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
import * as vm from "vm";

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

    const transformData = currentNode.data.transform;

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
        username: bot.username,
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
   * Безопасное выполнение JavaScript кода в изолированном контексте
   * Использует Node.js VM для изоляции от глобальных объектов
   */
  private executeCode(code: string, context: Record<string, any>): any {
    try {
      // Создаем изолированный контекст выполнения
      // Ограничиваем доступ к глобальным объектам
      const sandbox: Record<string, any> = {
        // Разрешаем только безопасные глобальные объекты
        console: {
          log: (...args: any[]) => this.logger.log(args.join(" ")),
          warn: (...args: any[]) => this.logger.warn(args.join(" ")),
          error: (...args: any[]) => this.logger.error(args.join(" ")),
        },
        // Базовые JavaScript объекты
        JSON: JSON,
        Math: Math,
        Date: Date,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Array: Array,
        Object: Object,
        RegExp: RegExp,
        Error: Error,
        TypeError: TypeError,
        RangeError: RangeError,
        // Разрешаем методы для работы с массивами и объектами
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        // Добавляем контекстные переменные
        ...context,
      };

      // Создаем изолированный контекст VM
      const vmContext = vm.createContext(sandbox);

      // Оборачиваем код в функцию для поддержки return
      const wrappedCode = `
        (function() {
          "use strict";
          ${code}
        })();
      `;

      // Создаем скрипт с ограничениями
      const script = new vm.Script(wrappedCode);

      // Выполняем код в изолированном контексте
      const result = script.runInContext(vmContext, {
        timeout: 5000,
        breakOnSigint: true,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : String(error);
      const errorStack = error instanceof Error ? error.stack : "";

      // Специальная обработка ошибок таймаута
      if (errorMessage.includes("Script execution timed out")) {
        this.logger.error("Выполнение кода превысило лимит времени (5 секунд)");
        throw new Error(
          "Выполнение кода превысило лимит времени. Упростите код или уменьшите количество операций."
        );
      }

      this.logger.error(`Детали ошибки выполнения кода: ${errorMessage}`);
      if (errorStack) {
        this.logger.error(`Стек ошибки: ${errorStack}`);
      }
      throw new Error(`Ошибка выполнения JavaScript кода: ${errorMessage}`);
    }
  }
}
