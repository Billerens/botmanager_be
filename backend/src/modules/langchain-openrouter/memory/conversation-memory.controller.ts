import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ConversationMemoryService } from "./conversation-memory.service";
import {
  GetSessionHistoryDto,
  ClearSessionDto,
  SessionInfoDto,
  MemoryStatsDto,
  SessionHistoryDto,
  SessionExportDto,
  SessionImportDto,
} from "../dto/memory.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

/**
 * Контроллер для управления памятью разговоров
 */
@ApiTags("LangChain Memory")
@Controller("langchain-openrouter/memory")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationMemoryController {
  private readonly logger = new Logger(ConversationMemoryController.name);

  constructor(
    private readonly memoryService: ConversationMemoryService,
  ) {}

  /**
   * Получить информацию о сессии
   */
  @Get("session/:sessionId")
  @ApiOperation({
    summary: "Информация о сессии",
    description: "Получает метаданные о конкретной сессии",
  })
  @ApiParam({
    name: "sessionId",
    description: "Идентификатор сессии",
    example: "session_123",
  })
  @ApiResponse({
    status: 200,
    description: "Информация о сессии",
    type: SessionInfoDto,
  })
  @ApiResponse({
    status: 404,
    description: "Сессия не найдена",
  })
  getSessionInfo(@Param("sessionId") sessionId: string) {
    this.logger.log(`Запрос информации о сессии: ${sessionId}`);
    
    const info = this.memoryService.getSessionInfo(sessionId);
    
    if (!info) {
      return {
        error: "Сессия не найдена",
        sessionId,
      };
    }
    
    return info;
  }

  /**
   * Получить историю сессии
   */
  @Get("session/:sessionId/history")
  @ApiOperation({
    summary: "История сообщений сессии",
    description: "Получает все сообщения из истории сессии",
  })
  @ApiParam({
    name: "sessionId",
    description: "Идентификатор сессии",
    example: "session_123",
  })
  @ApiResponse({
    status: 200,
    description: "История сообщений",
    type: SessionHistoryDto,
  })
  async getSessionHistory(
    @Param("sessionId") sessionId: string,
  ): Promise<SessionHistoryDto> {
    this.logger.log(`Запрос истории сессии: ${sessionId}`);
    
    const messages = await this.memoryService.getMessages(sessionId);
    
    return {
      sessionId,
      messages: messages.map((msg) => ({
        type: msg._getType(),
        content: msg.content as string,
      })),
      messageCount: messages.length,
    };
  }

  /**
   * Очистить сессию
   */
  @Delete("session/:sessionId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Очистка сессии",
    description: "Удаляет все сообщения и метаданные сессии",
  })
  @ApiParam({
    name: "sessionId",
    description: "Идентификатор сессии",
    example: "session_123",
  })
  @ApiResponse({
    status: 200,
    description: "Сессия успешно очищена",
  })
  async clearSession(@Param("sessionId") sessionId: string) {
    this.logger.log(`Очистка сессии: ${sessionId}`);
    
    await this.memoryService.clearSession(sessionId);
    
    return {
      success: true,
      message: `Сессия ${sessionId} успешно очищена`,
      sessionId,
    };
  }

  /**
   * Получить статистику по всем сессиям
   */
  @Get("stats")
  @ApiOperation({
    summary: "Статистика памяти",
    description: "Получает общую статистику по всем активным сессиям",
  })
  @ApiResponse({
    status: 200,
    description: "Статистика памяти",
    type: MemoryStatsDto,
  })
  getStats(): MemoryStatsDto {
    this.logger.log("Запрос статистики памяти");
    return this.memoryService.getStats();
  }

  /**
   * Экспортировать сессию
   */
  @Get("session/:sessionId/export")
  @ApiOperation({
    summary: "Экспорт сессии",
    description: "Экспортирует всю историю сессии в JSON формате",
  })
  @ApiParam({
    name: "sessionId",
    description: "Идентификатор сессии",
    example: "session_123",
  })
  @ApiResponse({
    status: 200,
    description: "Экспортированная сессия",
    type: SessionExportDto,
  })
  async exportSession(
    @Param("sessionId") sessionId: string,
  ): Promise<SessionExportDto> {
    this.logger.log(`Экспорт сессии: ${sessionId}`);
    return await this.memoryService.exportSession(sessionId);
  }

  /**
   * Импортировать сессию
   */
  @Post("session/import")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Импорт сессии",
    description: "Импортирует историю сообщений в новую или существующую сессию",
  })
  @ApiResponse({
    status: 200,
    description: "Сессия успешно импортирована",
  })
  async importSession(@Body() importData: SessionImportDto) {
    this.logger.log(`Импорт сессии: ${importData.sessionId}`);
    
    await this.memoryService.importSession(
      importData.sessionId,
      importData,
    );
    
    return {
      success: true,
      message: `Сессия ${importData.sessionId} успешно импортирована`,
      sessionId: importData.sessionId,
      messageCount: importData.messages.length,
    };
  }

  /**
   * Health check для памяти
   */
  @Get("health")
  @ApiOperation({
    summary: "Проверка здоровья памяти",
    description: "Проверяет работоспособность сервиса памяти",
  })
  @ApiResponse({
    status: 200,
    description: "Сервис памяти работает",
  })
  healthCheck() {
    const stats = this.memoryService.getStats();
    
    return {
      status: "healthy",
      service: "Conversation Memory",
      timestamp: new Date().toISOString(),
      stats,
    };
  }
}

