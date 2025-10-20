import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotFlow, FlowStatus } from "../../database/entities/bot-flow.entity";
import { BotFlowNode } from "../../database/entities/bot-flow-node.entity";
import { CustomLoggerService } from "../../common/logger.service";
import { FlowExecutionService } from "./flow-execution.service";

@ApiTags("Эндпоинты")
@Controller("endpoint")
export class EndpointController {
  constructor(
    @InjectRepository(BotFlow)
    private readonly botFlowRepository: Repository<BotFlow>,
    @InjectRepository(BotFlowNode)
    private readonly botFlowNodeRepository: Repository<BotFlowNode>,
    private readonly logger: CustomLoggerService,
    private readonly flowExecutionService: FlowExecutionService
  ) {}

  @Post(":botId/:nodeId/:url")
  @ApiOperation({
    summary: "Прием POST-запроса на эндпоинт ноды",
    description:
      "Принимает POST-запрос, проверяет accessKey и сохраняет данные в переменные сессии. Если в теле запроса передан userId, сохраняет данные в сессию пользователя и продолжает выполнение flow.",
  })
  @ApiParam({ name: "botId", description: "ID бота" })
  @ApiParam({ name: "nodeId", description: "ID ноды эндпоинта" })
  @ApiParam({ name: "url", description: "URL эндпоинта из настроек ноды" })
  @ApiResponse({ status: 200, description: "Запрос успешно обработан" })
  @ApiResponse({ status: 401, description: "Неверный Access Key" })
  @ApiResponse({ status: 404, description: "Эндпоинт не найден" })
  async handleEndpointRequest(
    @Param("botId") botId: string,
    @Param("nodeId") nodeId: string,
    @Param("url") url: string,
    @Headers("x-access-key") accessKey: string,
    @Body() body: any
  ) {
    this.logger.log(`=== ENDPOINT ЗАПРОС ===`);
    this.logger.log(`Bot ID: ${botId}`);
    this.logger.log(`Node ID: ${nodeId}`);
    this.logger.log(`URL: ${url}`);
    this.logger.log(`Access Key: ${accessKey ? "***" : "не предоставлен"}`);
    this.logger.log(`Body: ${JSON.stringify(body, null, 2)}`);

    // Находим активный flow для бота
    const activeFlow = await this.botFlowRepository.findOne({
      where: { botId, status: FlowStatus.ACTIVE },
      relations: ["nodes"],
    });

    if (!activeFlow) {
      this.logger.error(`Активный flow для бота ${botId} не найден`);
      throw new NotFoundException("Активный flow не найден");
    }

    // Находим ноду эндпоинта
    const endpointNode = activeFlow.nodes.find(
      (node) => node.nodeId === nodeId && node.type === "endpoint"
    );

    if (!endpointNode) {
      this.logger.error(`Endpoint нода ${nodeId} не найдена в flow`);
      throw new NotFoundException("Endpoint нода не найдена");
    }

    // Проверяем настройки эндпоинта
    const endpointData = endpointNode.data?.endpoint;
    if (!endpointData) {
      this.logger.error(`Данные endpoint не найдены для ноды ${nodeId}`);
      throw new NotFoundException("Настройки endpoint не найдены");
    }

    // Проверяем URL
    if (endpointData.url !== url) {
      this.logger.error(
        `URL не совпадает: ожидается ${endpointData.url}, получен ${url}`
      );
      throw new NotFoundException("URL эндпоинта не совпадает");
    }

    // Проверяем Access Key
    if (!accessKey || accessKey !== endpointData.accessKey) {
      this.logger.error(
        `Неверный Access Key для эндпоинта ${nodeId} бота ${botId}`
      );
      throw new UnauthorizedException("Неверный Access Key");
    }

    this.logger.log(`Эндпоинт найден и авторизован`);

    // Сохраняем данные из тела запроса в переменные
    // Используем специальный префикс для данных эндпоинта
    const endpointPrefix = `endpoint_${nodeId}_data`;

    // Создаем или обновляем сессию для сохранения данных
    // Поскольку это внешний запрос без контекста Telegram пользователя,
    // мы сохраняем данные в flow-контекст для дальнейшего использования
    // Данные будут доступны через переменные в последующих нодах

    try {
      // Извлекаем userId из тела запроса, если он есть
      const userId = body?.userId || body?.user_id;

      // Сохраняем весь объект body как JSON строку
      const bodyJson = JSON.stringify(body);

      // Создаем переменные для сохранения
      const variables: Record<string, any> = {
        [`${endpointPrefix}`]: bodyJson,
        [`${endpointPrefix}_received_at`]: new Date().toISOString(),
      };

      // Добавляем поля верхнего уровня для удобного доступа
      if (typeof body === "object" && body !== null) {
        for (const [key, value] of Object.entries(body)) {
          // Пропускаем служебные поля
          if (key === "userId" || key === "user_id") continue;

          const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
          variables[`${endpointPrefix}.${sanitizedKey}`] =
            typeof value === "object" ? JSON.stringify(value) : String(value);
        }
      }

      this.logger.log(`Сохранены переменные: ${JSON.stringify(variables)}`);

      // ВСЕГДА сохраняем данные в глобальное хранилище эндпоинтов
      this.flowExecutionService.saveEndpointData(botId, nodeId, variables);

      // Находим все активные сессии, ожидающие данные от этого endpoint
      const allSessions = this.flowExecutionService["userSessions"];
      const sessionsToProcess: string[] = [];

      // Ищем сессии, остановленные на этом endpoint узле
      for (const [sessionKey, session] of allSessions.entries()) {
        if (session.botId === botId && session.currentNodeId === nodeId) {
          // Обновляем переменные в сессии
          Object.assign(session.variables, variables);
          session.lastActivity = new Date();
          sessionsToProcess.push(session.userId);
          this.logger.log(
            `Найдена сессия пользователя ${session.userId}, ожидающая данные от endpoint ${nodeId}`
          );
        }
      }

      // Если передан userId, проверяем что его сессия тоже обновлена
      if (userId) {
        this.logger.log(`Найден userId: ${userId}, сохраняем в сессию`);

        const sessionKey = `${botId}-${userId}`;
        let userSession =
          this.flowExecutionService["userSessions"].get(sessionKey);

        if (userSession) {
          // Обновляем переменные в существующей сессии (если еще не обновлена)
          Object.assign(userSession.variables, variables);
          userSession.lastActivity = new Date();

          this.logger.log(
            `Переменные сохранены в сессию пользователя ${userId}`
          );

          // Добавляем в список на обработку, если еще не добавлен
          if (!sessionsToProcess.includes(userId)) {
            sessionsToProcess.push(userId);
          }
        } else {
          this.logger.log(
            `Сессия для пользователя ${userId} не найдена. Создаем новую и запускаем flow...`
          );

          // Создаем новую сессию для пользователя
          // Используем userId как chatId, если chatId не передан отдельно
          const chatId = body?.chatId || userId;

          userSession = {
            userId,
            chatId,
            botId,
            currentNodeId: nodeId, // Начинаем с endpoint ноды
            variables: { ...variables }, // Сразу добавляем данные из запроса
            lastActivity: new Date(),
          };

          this.flowExecutionService["userSessions"].set(
            sessionKey,
            userSession
          );

          this.logger.log(
            `Создана новая сессия для пользователя ${userId}. Запуск flow с endpoint ноды...`
          );

          // Запускаем flow с endpoint ноды
          this.flowExecutionService
            .continueFlowFromEndpoint(botId, userId, nodeId)
            .catch((error) => {
              this.logger.error(
                `Ошибка при запуске flow: ${error.message}`,
                error.stack
              );
            });

          return {
            success: true,
            message:
              "Данные получены, сессия создана, flow запущен с endpoint ноды.",
            endpointId: nodeId,
            botId: botId,
            userId: userId,
            sessionFound: false,
            sessionCreated: true,
            flowStarted: true,
            timestamp: new Date().toISOString(),
            dataKeys: Object.keys(variables),
            storage: "session_and_global",
            note: "Endpoint нода использована как точка входа в flow (вместо START)",
          };
        }
      }

      // Запускаем продолжение flow для всех найденных сессий
      if (sessionsToProcess.length > 0) {
        this.logger.log(
          `Запускаем продолжение flow для ${sessionsToProcess.length} сессий: ${sessionsToProcess.join(", ")}`
        );

        // Запускаем асинхронно для каждой сессии
        for (const sessionUserId of sessionsToProcess) {
          this.flowExecutionService
            .continueFlowFromEndpoint(botId, sessionUserId, nodeId)
            .catch((error) => {
              this.logger.error(
                `Ошибка при продолжении flow для пользователя ${sessionUserId}: ${error.message}`,
                error.stack
              );
            });
        }

        return {
          success: true,
          message: `Данные получены и flow продолжен для ${sessionsToProcess.length} пользователей`,
          endpointId: nodeId,
          botId: botId,
          sessionsProcessed: sessionsToProcess.length,
          sessionUsers: sessionsToProcess,
          timestamp: new Date().toISOString(),
          dataKeys: Object.keys(variables),
          storage: "session_and_global",
        };
      }

      // Если нет активных сессий, создаем системную сессию и выполняем flow
      this.logger.log(
        `Нет активных сессий, ожидающих данные от endpoint ${nodeId}. Создаем системную сессию для выполнения flow.`
      );

      // Создаем временную системную сессию для выполнения flow
      const systemUserId = `system_${Date.now()}`;
      const systemSessionKey = `${botId}-${systemUserId}`;

      const systemSession = {
        userId: systemUserId,
        chatId: systemUserId,
        botId,
        currentNodeId: nodeId,
        variables: { ...variables },
        lastActivity: new Date(),
      };

      this.flowExecutionService["userSessions"].set(
        systemSessionKey,
        systemSession
      );

      this.logger.log(
        `Создана системная сессия ${systemUserId} для выполнения flow с endpoint ноды`
      );

      // Запускаем выполнение flow с endpoint ноды
      this.flowExecutionService
        .continueFlowFromEndpoint(botId, systemUserId, nodeId)
        .then(() => {
          // После выполнения удаляем системную сессию
          this.flowExecutionService["userSessions"].delete(systemSessionKey);
          this.logger.log(
            `Системная сессия ${systemUserId} удалена после выполнения flow`
          );
        })
        .catch((error) => {
          this.logger.error(
            `Ошибка при выполнении flow в системной сессии: ${error.message}`,
            error.stack
          );
          // Удаляем системную сессию даже при ошибке
          this.flowExecutionService["userSessions"].delete(systemSessionKey);
        });

      return {
        success: true,
        message: "Данные получены и flow запущен в системной сессии",
        endpointId: nodeId,
        botId: botId,
        systemSession: systemUserId,
        note: "Flow выполняется автоматически без привязки к конкретному пользователю",
        timestamp: new Date().toISOString(),
        dataKeys: Object.keys(variables),
        storage: "global",
      };
    } catch (error) {
      this.logger.error(
        `Ошибка при обработке данных эндпоинта: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        "Ошибка при обработке данных",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
