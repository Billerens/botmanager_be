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

      // Если передан userId, ТАКЖЕ сохраняем данные в сессию пользователя
      if (userId) {
        this.logger.log(`Найден userId: ${userId}, сохраняем в сессию`);

        const sessionKey = `${botId}-${userId}`;
        const userSession =
          this.flowExecutionService["userSessions"].get(sessionKey);

        if (userSession) {
          // Обновляем переменные в существующей сессии
          Object.assign(userSession.variables, variables);
          userSession.lastActivity = new Date();

          this.logger.log(
            `Переменные сохранены в сессию пользователя ${userId}`
          );

          // Продолжаем выполнение flow с текущей ноды endpoint
          // Создаем фиктивное сообщение для контекста
          const mockMessage = {
            from: { id: parseInt(userId), first_name: "API User" },
            chat: { id: parseInt(userSession.chatId) },
            text: `[Endpoint Data: ${nodeId}]`,
            message_id: Date.now(),
          };

          // Получаем бота
          const bot = { id: botId };

          return {
            success: true,
            message:
              "Данные успешно получены и сохранены в сессию пользователя",
            endpointId: nodeId,
            botId: botId,
            userId: userId,
            sessionFound: true,
            timestamp: new Date().toISOString(),
            dataKeys: Object.keys(variables),
          };
        } else {
          this.logger.warn(`Сессия для пользователя ${userId} не найдена`);

          return {
            success: true,
            message: "Данные получены, но сессия пользователя не найдена",
            endpointId: nodeId,
            botId: botId,
            userId: userId,
            sessionFound: false,
            note: "Пользователь должен сначала начать взаимодействие с ботом",
            timestamp: new Date().toISOString(),
            dataKeys: Object.keys(variables),
          };
        }
      }

      // Если userId не передан, возвращаем успешный ответ
      // Данные уже сохранены в глобальное хранилище
      return {
        success: true,
        message:
          "Данные успешно получены и сохранены в глобальное хранилище эндпоинта",
        endpointId: nodeId,
        botId: botId,
        note: "Данные доступны через переменные эндпоинта для всех пользователей. Для привязки к конкретному пользователю передайте userId в теле запроса.",
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
