import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { Response } from "express";
import { LangChainOpenRouterService } from "./langchain-openrouter.service";
import {
  LangChainChatRequestDto,
  SimpleTextRequestDto,
  LangChainChatResponseDto,
  LangChainErrorResponseDto,
} from "./dto/langchain-chat.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

/**
 * Контроллер для работы с LangChain и OpenRouter
 * Предоставляет REST API для взаимодействия с LLM моделями
 */
@ApiTags("LangChain OpenRouter")
@Controller("langchain-openrouter")
export class LangChainOpenRouterController {
  private readonly logger = new Logger(LangChainOpenRouterController.name);

  constructor(private readonly langchainService: LangChainOpenRouterService) {}

  /**
   * Основной endpoint для чата с использованием LangChain
   */
  @Post("chat")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Чат с LLM через LangChain",
    description:
      "Отправляет историю сообщений в LLM и получает ответ. Поддерживает различные параметры генерации.",
  })
  @ApiResponse({
    status: 200,
    description: "Успешный ответ от модели",
    type: LangChainChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Неверные параметры запроса",
    type: LangChainErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Не авторизован",
  })
  @ApiBody({ type: LangChainChatRequestDto })
  async chat(
    @Body() request: LangChainChatRequestDto
  ): Promise<LangChainChatResponseDto> {
    this.logger.log(
      `Получен запрос на чат с ${request.messages.length} сообщениями`
    );

    try {
      return await this.langchainService.chat(request);
    } catch (error) {
      this.logger.error(`Ошибка при обработке чата: ${error.message}`);
      throw error;
    }
  }

  /**
   * Упрощенный endpoint для быстрых текстовых запросов
   */
  @Post("prompt")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Простой текстовый промпт",
    description:
      "Упрощенный метод для быстрых запросов. Принимает текст и опциональный системный промпт.",
  })
  @ApiResponse({
    status: 200,
    description: "Успешный ответ от модели",
    type: LangChainChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Неверные параметры запроса",
    type: LangChainErrorResponseDto,
  })
  @ApiBody({ type: SimpleTextRequestDto })
  async simplePrompt(
    @Body() request: SimpleTextRequestDto
  ): Promise<LangChainChatResponseDto> {
    this.logger.log(`Получен простой текстовый запрос`);

    try {
      return await this.langchainService.simplePrompt(request);
    } catch (error) {
      this.logger.error(`Ошибка при обработке промпта: ${error.message}`);
      throw error;
    }
  }

  /**
   * Endpoint для потоковой генерации (Server-Sent Events)
   */
  @Post("chat/stream")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Потоковый чат с LLM",
    description:
      "Возвращает ответ модели по частям в реальном времени через Server-Sent Events (SSE).",
  })
  @ApiResponse({
    status: 200,
    description: "Поток данных успешно инициирован",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные параметры запроса",
  })
  @ApiBody({ type: LangChainChatRequestDto })
  async chatStream(
    @Body() request: LangChainChatRequestDto,
    @Res() response: Response
  ): Promise<void> {
    this.logger.log(`Начало потоковой генерации`);

    // Интервал heartbeat для поддержания соединения (15 секунд)
    const HEARTBEAT_INTERVAL = 15000;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let isStreamEnded = false;

    // Функция для отправки heartbeat
    const sendHeartbeat = () => {
      if (!isStreamEnded) {
        const heartbeatData = JSON.stringify({ heartbeat: true, done: false });
        response.write(`data: ${heartbeatData}\n\n`);
        this.logger.debug("Heartbeat отправлен для поддержания SSE соединения");
      }
    };

    // Функция для остановки heartbeat
    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      isStreamEnded = true;
    };

    try {
      // Настраиваем заголовки для SSE
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");

      // Отправляем начальный чанк для подтверждения соединения
      const initData = JSON.stringify({ init: true, done: false });
      response.write(`data: ${initData}\n\n`);

      // Запускаем heartbeat для поддержания соединения
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

      // Обработка закрытия соединения клиентом
      response.on("close", () => {
        this.logger.log("SSE соединение закрыто клиентом");
        stopHeartbeat();
      });

      // Получаем генератор потока
      const stream = this.langchainService.chatStream(request);

      // Отправляем данные по мере их поступления
      for await (const chunk of stream) {
        if (isStreamEnded) break;
        const data = JSON.stringify({ content: chunk, done: false });
        response.write(`data: ${data}\n\n`);
      }

      // Останавливаем heartbeat
      stopHeartbeat();

      // Отправляем финальный чанк
      const finalData = JSON.stringify({ content: "", done: true });
      response.write(`data: ${finalData}\n\n`);

      // Закрываем соединение
      response.end();

      this.logger.log(`Потоковая генерация завершена`);
    } catch (error) {
      // Останавливаем heartbeat при ошибке
      stopHeartbeat();

      this.logger.error(`Ошибка при потоковой генерации: ${error.message}`);

      // Отправляем ошибку в потоке
      const errorData = JSON.stringify({
        error: error.message,
        done: true,
      });
      response.write(`data: ${errorData}\n\n`);
      response.end();
    }
  }

  /**
   * Endpoint для выполнения цепочки LangChain
   */
  @Post("chain")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Выполнение цепочки LangChain",
    description:
      "Выполняет запрос через цепочку LangChain для более сложной обработки.",
  })
  @ApiResponse({
    status: 200,
    description: "Успешное выполнение цепочки",
    type: LangChainChatResponseDto,
  })
  @ApiBody({ type: LangChainChatRequestDto })
  async executeChain(
    @Body() request: LangChainChatRequestDto
  ): Promise<LangChainChatResponseDto> {
    this.logger.log(`Получен запрос на выполнение цепочки`);

    try {
      return await this.langchainService.executeChain(request);
    } catch (error) {
      this.logger.error(`Ошибка при выполнении цепочки: ${error.message}`);
      throw error;
    }
  }

  /**
   * Endpoint для батч-обработки
   */
  @Post("batch")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Батч-обработка запросов",
    description:
      "Обрабатывает несколько запросов параллельно для повышения производительности.",
  })
  @ApiResponse({
    status: 200,
    description: "Успешная батч-обработка",
    type: [LangChainChatResponseDto],
  })
  @ApiBody({ type: [LangChainChatRequestDto] })
  async batchProcess(
    @Body() requests: LangChainChatRequestDto[]
  ): Promise<LangChainChatResponseDto[]> {
    this.logger.log(
      `Получен запрос на батч-обработку ${requests.length} запросов`
    );

    if (!Array.isArray(requests) || requests.length === 0) {
      throw new BadRequestException("Необходимо предоставить массив запросов");
    }

    try {
      return await this.langchainService.batchProcess(requests);
    } catch (error) {
      this.logger.error(`Ошибка при батч-обработке: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получение информации о сервисе
   */
  @Get("info")
  @ApiOperation({
    summary: "Информация о сервисе",
    description: "Возвращает информацию о конфигурации и возможностях сервиса.",
  })
  @ApiResponse({
    status: 200,
    description: "Информация о сервисе",
  })
  getInfo() {
    return this.langchainService.getServiceInfo();
  }

  /**
   * Health check endpoint
   */
  @Get("health")
  @ApiOperation({
    summary: "Проверка здоровья сервиса",
    description: "Проверяет, работает ли сервис корректно.",
  })
  @ApiResponse({
    status: 200,
    description: "Сервис работает корректно",
  })
  healthCheck() {
    return {
      status: "healthy",
      service: "LangChain OpenRouter",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Переподключение к прокси
   */
  @Post("proxy/reconnect")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Переподключение к VPN прокси",
    description:
      "Повторно проверяет доступность прокси и переподключается, если прокси снова доступен.",
  })
  @ApiResponse({
    status: 200,
    description: "Результат переподключения к прокси",
  })
  async reconnectProxy() {
    this.logger.log("Получен запрос на переподключение к прокси");

    try {
      const connected = await this.langchainService.reconnectProxy();
      const serviceInfo = this.langchainService.getServiceInfo();

      return {
        success: connected,
        message: connected
          ? "Прокси успешно подключен"
          : "Прокси недоступен, используется прямое подключение",
        proxy: serviceInfo.proxy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Ошибка при переподключении к прокси: ${error.message}`
      );
      throw error;
    }
  }
}
