import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsArray } from "class-validator";

/**
 * Запрос для получения истории сессии
 */
export class GetSessionHistoryDto {
  @ApiProperty({
    example: "session_123",
    description: "Идентификатор сессии",
  })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    example: 10,
    description: "Количество последних сообщений для получения (опционально)",
  })
  @IsOptional()
  @IsNumber()
  lastN?: number;
}

/**
 * Запрос для очистки сессии
 */
export class ClearSessionDto {
  @ApiProperty({
    example: "session_123",
    description: "Идентификатор сессии для очистки",
  })
  @IsString()
  sessionId: string;
}

/**
 * Информация о сессии
 */
export class SessionInfoDto {
  @ApiProperty({
    example: "session_123",
    description: "Идентификатор сессии",
  })
  sessionId: string;

  @ApiProperty({
    example: "2025-11-12T10:00:00.000Z",
    description: "Время создания сессии",
  })
  createdAt: Date;

  @ApiProperty({
    example: "2025-11-12T11:30:00.000Z",
    description: "Время последнего обращения к сессии",
  })
  lastAccessedAt: Date;

  @ApiProperty({
    example: 25,
    description: "Количество сообщений в сессии",
  })
  messageCount: number;

  @ApiProperty({
    example: 90,
    description: "Возраст сессии в минутах",
  })
  ageInMinutes: number;
}

/**
 * Статистика по всем сессиям
 */
export class MemoryStatsDto {
  @ApiProperty({
    example: 15,
    description: "Общее количество активных сессий",
  })
  totalSessions: number;

  @ApiProperty({
    example: 375,
    description: "Общее количество сообщений во всех сессиях",
  })
  totalMessages: number;

  @ApiProperty({
    example: "25.00",
    description: "Среднее количество сообщений на сессию",
  })
  averageMessagesPerSession: string;

  @ApiPropertyOptional({
    example: 1699999999000,
    description: "Timestamp самой старой сессии",
  })
  oldestSession: number | null;
}

/**
 * Сообщение из истории
 */
export class HistoryMessageDto {
  @ApiProperty({
    enum: ["system", "human", "ai", "function"],
    example: "human",
    description: "Тип сообщения",
  })
  type: string;

  @ApiProperty({
    example: "Привет! Как дела?",
    description: "Содержимое сообщения",
  })
  content: string;
}

/**
 * История сообщений сессии
 */
export class SessionHistoryDto {
  @ApiProperty({
    example: "session_123",
    description: "Идентификатор сессии",
  })
  sessionId: string;

  @ApiProperty({
    type: [HistoryMessageDto],
    description: "Массив сообщений",
  })
  messages: HistoryMessageDto[];

  @ApiProperty({
    example: 25,
    description: "Количество сообщений",
  })
  messageCount: number;
}

/**
 * Экспорт сессии
 */
export class SessionExportDto {
  @ApiProperty({
    type: SessionInfoDto,
    description: "Информация о сессии",
  })
  sessionInfo: SessionInfoDto | null;

  @ApiProperty({
    type: [HistoryMessageDto],
    description: "Все сообщения сессии",
  })
  messages: HistoryMessageDto[];
}

/**
 * Импорт сессии
 */
export class SessionImportDto {
  @ApiProperty({
    example: "session_123",
    description: "Идентификатор сессии",
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    type: [Object],
    description: "Массив сообщений для импорта",
  })
  @IsArray()
  messages: Array<{
    type: string;
    content: string;
  }>;
}

