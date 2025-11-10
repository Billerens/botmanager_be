import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO для запуска модели через bytez.js
 */
export class BytezModelRunDto {
  @ApiProperty({
    description:
      "ID модели для использования (например, 'mbiarreta/swin-camdeboo-loc')",
    example: "mbiarreta/swin-camdeboo-loc",
  })
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @ApiProperty({
    description:
      "Входные данные для модели. Может быть строкой, объектом или массивом в зависимости от модели",
    example: "https://example.com/image.jpg",
  })
  @IsNotEmpty()
  input: any; // Может быть строкой, объектом, массивом и т.д. в зависимости от модели

  @ApiProperty({
    description: "Дополнительные параметры для модели (опционально)",
    required: false,
    example: {},
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

/**
 * DTO для ответа от модели bytez.js
 */
export class BytezModelResponseDto {
  @ApiProperty({
    description: "Результат выполнения модели",
  })
  output: any;

  @ApiProperty({
    description: "Ошибка, если произошла (опционально)",
    required: false,
  })
  @IsOptional()
  error?: string;

  @ApiProperty({
    description: "Метаданные выполнения (опционально)",
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO для получения информации о модели
 */
export class BytezModelInfoDto {
  @ApiProperty({
    description: "ID модели",
    example: "mbiarreta/swin-camdeboo-loc",
  })
  @IsString()
  @IsNotEmpty()
  modelId: string;
}

/**
 * DTO для получения списка моделей
 */
export class BytezListModelsDto {
  @ApiProperty({
    description: "Поисковый запрос (опционально)",
    required: false,
    example: "image classification",
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: "Количество результатов (опционально)",
    required: false,
    example: 10,
  })
  @IsOptional()
  limit?: number;
}

/**
 * DTO для сообщения в чате
 */
export class BytezChatMessageDto {
  @ApiProperty({
    description: "Роль отправителя сообщения",
    example: "user",
    enum: ["system", "user", "assistant"],
  })
  @IsString()
  @IsNotEmpty()
  role: "system" | "user" | "assistant";

  @ApiProperty({
    description: "Содержимое сообщения",
    example: "Привет! Как дела?",
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

/**
 * DTO для создания chat completion через bytez
 */
export class BytezChatCompletionCreateParamsDto {
  @ApiProperty({
    description: "ID модели для чата",
    example: "meta-llama/Llama-3.1-8B-Instruct",
  })
  @IsString()
  @IsNotEmpty()
  modelId: string;

  @ApiProperty({
    description: "Массив сообщений для чата",
    type: [BytezChatMessageDto],
  })
  @IsNotEmpty()
  messages: BytezChatMessageDto[];

  @ApiProperty({
    description: "Температура для генерации (0-2)",
    required: false,
    example: 0.7,
  })
  @IsOptional()
  temperature?: number;

  @ApiProperty({
    description: "Максимальное количество токенов в ответе",
    required: false,
    example: 1000,
  })
  @IsOptional()
  maxTokens?: number;

  @ApiProperty({
    description: "Включить стриминг",
    required: false,
    example: false,
  })
  @IsOptional()
  stream?: boolean;
}

/**
 * DTO для ответа chat completion через bytez
 */
export class BytezChatCompletionResponseDto {
  @ApiProperty({
    description: "Ответ модели",
  })
  output: string;

  @ApiProperty({
    description: "Ошибка, если произошла (опционально)",
    required: false,
  })
  @IsOptional()
  error?: string;

  @ApiProperty({
    description: "Метаданные выполнения (опционально)",
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}