import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../../database/entities/bot-flow-node.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { BotsService } from "../bots.service";
import { CustomLoggerService } from "../../../common/logger.service";
import { MessagesService } from "../../messages/messages.service";
import { FlowContext } from "./base-node-handler.interface";
import { BaseNodeHandler } from "./base-node-handler";

@Injectable()
export class WebhookNodeHandler extends BaseNodeHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === "webhook";
  }

  async execute(context: FlowContext): Promise<void> {
    const { currentNode, session } = context;

    if (!currentNode?.data?.webhook) {
      this.logger.warn("Данные webhook не найдены");
      return;
    }

    const webhookData = currentNode.data.webhook;
    const { url, method, headers, body, timeout, retryCount } = webhookData;

    // Подставляем переменные в URL
    const processedUrl = this.substituteVariables(url || "", context);

    // Валидация URL
    if (!processedUrl || processedUrl.trim() === "") {
      this.logger.error("URL webhook не задан");
      session.variables[`webhook_${currentNode.nodeId}_error_type`] = "config";
      session.variables[`webhook_${currentNode.nodeId}_error_message`] =
        "URL не задан";
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    // Проверка корректности URL
    try {
      new URL(processedUrl);
    } catch (urlError) {
      this.logger.error(`Некорректный URL: ${processedUrl}`);
      session.variables[`webhook_${currentNode.nodeId}_error_type`] = "config";
      session.variables[`webhook_${currentNode.nodeId}_error_message`] =
        `Некорректный URL: ${processedUrl}`;
      await this.moveToNextNode(context, currentNode.nodeId);
      return;
    }

    // Фильтруем пустые заголовки и подставляем переменные
    const processedHeaders = headers
      ? Object.fromEntries(
          Object.entries(headers)
            .filter(([key, value]) => key.trim() !== "" && value.trim() !== "")
            .map(([key, value]) => [
              key,
              this.substituteVariables(value, context),
            ])
        )
      : {};

    // Подставляем переменные в тело запроса
    const processedBody = this.substituteVariables(body || "", context);

    this.logger.log(`=== WEBHOOK УЗЕЛ ВЫПОЛНЕНИЕ ===`);
    this.logger.log(`Узел ID: ${currentNode.nodeId}`);
    this.logger.log(`Пользователь: ${session.userId}`);
    this.logger.log(`Исходный URL: ${url}`);
    this.logger.log(`Обработанный URL: ${processedUrl}`);
    this.logger.log(`Метод: ${method}`);
    this.logger.log(`Заголовки: ${JSON.stringify(processedHeaders, null, 2)}`);
    this.logger.log(`Исходное тело запроса: ${body}`);
    this.logger.log(`Обработанное тело запроса: ${processedBody}`);
    this.logger.log(`Таймаут: ${timeout}с`);
    this.logger.log(`Количество повторов: ${retryCount || 0}`);

    try {
      // Подготавливаем конфигурацию axios
      const axiosConfig: AxiosRequestConfig = {
        method: method || "POST",
        url: processedUrl,
        timeout: (timeout || 30) * 1000, // Конвертируем секунды в миллисекунды
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "UForge-Webhook/1.0",
          ...processedHeaders,
        },
        validateStatus: (status) => status < 500, // Не выбрасывать ошибку для 4xx статусов
      };

      // Добавляем тело запроса если есть
      if (processedBody && processedBody.trim() !== "") {
        try {
          // Пытаемся парсить как JSON
          const parsedBody = JSON.parse(processedBody);
          axiosConfig.data = parsedBody;
          // Content-Type остается application/json
        } catch (parseError) {
          // Если не JSON, отправляем как строку
          axiosConfig.data = processedBody;
          axiosConfig.headers["Content-Type"] = "text/plain";
          this.logger.log(
            `Тело запроса не является валидным JSON, отправляем как текст`
          );
        }
      } else if (method === "POST" || method === "PUT") {
        // Для POST/PUT запросов без тела добавляем пустой объект
        axiosConfig.data = {};
      }

      this.logger.log(`Отправляем HTTP запрос...`);
      this.logger.log(
        `Конфигурация axios: ${JSON.stringify(
          {
            method: axiosConfig.method,
            url: axiosConfig.url,
            timeout: axiosConfig.timeout,
            headers: axiosConfig.headers,
            hasData: !!axiosConfig.data,
          },
          null,
          2
        )}`
      );

      // Выполняем запрос с повторными попытками
      let lastError: any = null;
      let attempt = 0;
      const maxAttempts = (retryCount || 0) + 1;
      let startTime: number;

      while (attempt < maxAttempts) {
        attempt++;

        if (attempt > 1) {
          this.logger.log(`Повторная попытка ${attempt}/${maxAttempts}...`);
          // Задержка между попытками (экспоненциальная)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt - 2) * 1000)
          );
        }

        try {
          startTime = Date.now();
          const response: AxiosResponse = await axios(axiosConfig);
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.log(`=== WEBHOOK УСПЕШНЫЙ ОТВЕТ ===`);
          this.logger.log(`Статус: ${response.status} ${response.statusText}`);
          this.logger.log(`Время выполнения: ${duration}мс`);
          this.logger.log(
            `Заголовки ответа: ${JSON.stringify(response.headers, null, 2)}`
          );
          this.logger.log(
            `Размер ответа: ${JSON.stringify(response.data).length} символов`
          );

          // Логируем тело ответа (ограничиваем размер для логов)
          const responseDataStr = JSON.stringify(response.data);
          if (responseDataStr.length > 1000) {
            this.logger.log(
              `Тело ответа (первые 1000 символов): ${responseDataStr.substring(0, 1000)}...`
            );
          } else {
            this.logger.log(`Тело ответа: ${responseDataStr}`);
          }

          // Сохраняем результат в переменные сессии для дальнейшего использования
          session.variables[`webhook_${currentNode.nodeId}_status`] =
            response.status.toString();
          session.variables[`webhook_${currentNode.nodeId}_response`] =
            JSON.stringify(response.data);
          session.variables[`webhook_${currentNode.nodeId}_duration`] =
            duration.toString();

          this.logger.log(`Результат сохранен в переменные сессии`);
          break; // Успешный запрос, выходим из цикла
        } catch (error: any) {
          lastError = error;
          const endTime = Date.now();
          const duration = endTime - startTime; // Исправлено: было Date.now()

          this.logger.error(
            `=== WEBHOOK ОШИБКА (попытка ${attempt}/${maxAttempts}) ===`
          );
          this.logger.error(`Ошибка: ${error.message}`);
          this.logger.error(`Код ошибки: ${error.code || "N/A"}`);
          this.logger.error(`Время до ошибки: ${duration}мс`);

          if (error.response) {
            // Сервер ответил с кодом ошибки
            this.logger.error(
              `Статус ответа: ${error.response.status} ${error.response.statusText}`
            );
            this.logger.error(
              `Заголовки ответа: ${JSON.stringify(error.response.headers, null, 2)}`
            );
            this.logger.error(
              `Тело ошибки: ${JSON.stringify(error.response.data, null, 2)}`
            );

            // Сохраняем информацию об ошибке в переменные
            session.variables[`webhook_${currentNode.nodeId}_error_status`] =
              error.response.status.toString();
            session.variables[`webhook_${currentNode.nodeId}_error_response`] =
              JSON.stringify(error.response.data);
          } else if (error.request) {
            // Запрос был отправлен, но ответа не получено
            this.logger.error(`Запрос отправлен, но ответа не получено`);
            this.logger.error(
              `Детали запроса: ${JSON.stringify(error.request, null, 2)}`
            );

            session.variables[`webhook_${currentNode.nodeId}_error_type`] =
              "timeout";
            session.variables[`webhook_${currentNode.nodeId}_error_message`] =
              error.message;
          } else {
            // Ошибка при настройке запроса
            this.logger.error(`Ошибка настройки запроса: ${error.message}`);

            session.variables[`webhook_${currentNode.nodeId}_error_type`] =
              "config";
            session.variables[`webhook_${currentNode.nodeId}_error_message`] =
              error.message;
          }

          // Если это последняя попытка, не продолжаем
          if (attempt >= maxAttempts) {
            this.logger.error(
              `Все попытки исчерпаны. Webhook завершился с ошибкой.`
            );
            break;
          }
        }
      }

      // Переходим к следующему узлу независимо от результата
      await this.moveToNextNode(context, currentNode.nodeId);
    } catch (error) {
      this.logger.error("Критическая ошибка выполнения webhook узла:", error);

      // Сохраняем критическую ошибку в переменные
      session.variables[`webhook_${currentNode.nodeId}_critical_error`] =
        error.message;

      // Переходим к следующему узлу даже при критической ошибке
      await this.moveToNextNode(context, currentNode.nodeId);
    }
  }
}
