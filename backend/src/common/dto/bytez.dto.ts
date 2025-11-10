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
