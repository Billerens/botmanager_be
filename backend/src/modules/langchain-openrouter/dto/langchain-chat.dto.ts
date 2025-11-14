import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Роли сообщений в чате
 */
export enum MessageRole {
  SYSTEM = "system",
  HUMAN = "human",
  AI = "ai",
  FUNCTION = "function",
}

/**
 * Одно сообщение в истории чата
 */
export class ChatMessageDto {
  @ApiProperty({
    enum: MessageRole,
    example: MessageRole.HUMAN,
    description: "Роль отправителя сообщения",
  })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty({
    example: "Привет! Как дела?",
    description: "Содержимое сообщения",
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: "user_123",
    description: "Идентификатор отправителя (опционально)",
  })
  @IsOptional()
  @IsString()
  senderId?: string;

  @ApiPropertyOptional({
    type: Object,
    description: "Дополнительные метаданные сообщения",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Параметры модели для генерации
 */
export class ModelParametersDto {
  @ApiPropertyOptional({
    example: 0.7,
    minimum: 0,
    maximum: 2,
    description:
      "Температура - контролирует случайность ответов (0 = детерминированно, 2 = очень случайно)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    example: 2000,
    minimum: 1,
    description: "Максимальное количество токенов для генерации",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional({
    example: 0.9,
    minimum: 0,
    maximum: 1,
    description: "Top P - ядерная выборка (nucleus sampling)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @ApiPropertyOptional({
    example: 40,
    minimum: 1,
    description: "Top K - количество токенов для рассмотрения",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  topK?: number;

  @ApiPropertyOptional({
    example: 0.5,
    minimum: -2,
    maximum: 2,
    description: "Штраф за частоту повторяющихся токенов",
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequencyPenalty?: number;

  @ApiPropertyOptional({
    example: 0.5,
    minimum: -2,
    maximum: 2,
    description: "Штраф за присутствие уже использованных токенов",
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presencePenalty?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ["\n\n", "Конец"],
    description: "Последовательности для остановки генерации",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopSequences?: string[];
}

/**
 * Основной запрос для чата с использованием LangChain
 */
export class LangChainChatRequestDto {
  @ApiProperty({
    type: [ChatMessageDto],
    description: "История сообщений чата",
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({
    example: "meta-llama/llama-3.3-70b-instruct",
    description:
      "ID модели OpenRouter (если не указано, используется модель по умолчанию)",
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    type: ModelParametersDto,
    description: "Параметры генерации модели",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelParametersDto)
  parameters?: ModelParametersDto;

  @ApiPropertyOptional({
    example: false,
    description: "Включить потоковую передачу ответа (streaming)",
  })
  @ApiPropertyOptional({
    example: false,
    description: "Включить потоковую передачу ответа (streaming)",
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiPropertyOptional({
    example: "chat_session_123",
    description: "Идентификатор сессии для отслеживания контекста",
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    type: [Object],
    description: "Инструменты (tools) для function calling",
    example: [
      {
        type: "function",
        function: {
          name: "style_apply",
          description: "Применить CSS стили к странице",
          parameters: {
            type: "object",
            properties: {
              context: { type: "string", enum: ["booking", "shop"] },
              cssRules: { type: "string" },
              botId: { type: "string" }
            },
            required: ["context", "cssRules"]
          }
        }
      }
    ],
  })
  @IsOptional()
  @IsArray()
  tools?: any[];

  @ApiPropertyOptional({
    type: Object,
    description: "Дополнительные метаданные запроса",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Простой текстовый запрос (упрощенная версия)
 */
export class SimpleTextRequestDto {
  @ApiProperty({
    example: "Расскажи мне интересный факт о космосе",
    description: "Текст запроса пользователя",
  })
  @IsString()
  prompt: string;

  @ApiPropertyOptional({
    example: "Ты - дружелюбный ассистент, который помогает пользователям",
    description: "Системный промпт (контекст для модели)",
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    example: "meta-llama/llama-3.3-70b-instruct",
    description: "ID модели OpenRouter",
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    type: ModelParametersDto,
    description: "Параметры генерации модели",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelParametersDto)
  parameters?: ModelParametersDto;

  @ApiPropertyOptional({
    example: false,
    description: "Включить потоковую передачу",
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}

/**
 * Информация об использовании токенов
 */
export class TokenUsageDto {
  @ApiProperty({
    example: 150,
    description: "Количество токенов в промпте",
  })
  promptTokens: number;

  @ApiProperty({
    example: 250,
    description: "Количество токенов в ответе",
  })
  completionTokens: number;

  @ApiProperty({
    example: 400,
    description: "Общее количество использованных токенов",
  })
  totalTokens: number;
}

/**
 * Метаданные ответа от модели
 */
export class ResponseMetadataDto {
  @ApiProperty({
    example: "meta-llama/llama-3.3-70b-instruct",
    description: "Использованная модель",
  })
  model: string;

  @ApiPropertyOptional({
    example: "stop",
    description: "Причина завершения генерации",
  })
  finishReason?: string;

  @ApiPropertyOptional({
    type: TokenUsageDto,
    description: "Информация об использовании токенов",
  })
  usage?: TokenUsageDto;

  @ApiPropertyOptional({
    example: 1.234,
    description: "Время генерации в секундах",
  })
  generationTime?: number;

  @ApiPropertyOptional({
    type: Object,
    description: "Дополнительные метаданные от провайдера",
  })
  additionalMetadata?: Record<string, any>;
}

/**
 * Успешный ответ от LangChain сервиса
 */
export class LangChainChatResponseDto {
  @ApiProperty({
    example: "Конечно! Вот интересный факт о космосе...",
    description: "Сгенерированный ответ от модели",
  })
  content: string;

  @ApiProperty({
    type: ResponseMetadataDto,
    description: "Метаданные ответа",
  })
  metadata: ResponseMetadataDto;

  @ApiPropertyOptional({
    example: "chat_session_123",
    description: "Идентификатор сессии",
  })
  sessionId?: string;

  @ApiProperty({
    example: "2025-11-12T10:30:45.123Z",
    description: "Время создания ответа",
  })
  timestamp: string;
}

/**
 * Потоковый чанк данных
 */
export class StreamChunkDto {
  @ApiProperty({
    example: "Привет",
    description: "Часть текста в потоке",
  })
  content: string;

  @ApiPropertyOptional({
    example: false,
    description: "Является ли это последним чанком",
  })
  done?: boolean;

  @ApiPropertyOptional({
    type: ResponseMetadataDto,
    description: "Метаданные (только в последнем чанке)",
  })
  metadata?: ResponseMetadataDto;
}

/**
 * Ответ с ошибкой
 */
export class LangChainErrorResponseDto {
  @ApiProperty({
    example: "BAD_REQUEST",
    description: "Код ошибки",
  })
  errorCode: string;

  @ApiProperty({
    example: "Неверные параметры запроса",
    description: "Сообщение об ошибке",
  })
  message: string;

  @ApiPropertyOptional({
    type: Object,
    description: "Дополнительные детали ошибки",
  })
  details?: Record<string, any>;

  @ApiProperty({
    example: "2025-11-12T10:30:45.123Z",
    description: "Время возникновения ошибки",
  })
  timestamp: string;
}
