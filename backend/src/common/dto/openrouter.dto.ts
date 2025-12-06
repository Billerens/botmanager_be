import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsEnum,
  Min,
  Max,
  IsNotEmpty,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Типы контента в сообщениях
 */
export class VerboseTextContentDto {
  @ApiProperty({ enum: ["text"], example: "text" })
  @IsEnum(["text"])
  type: "text";

  @ApiProperty({ example: "Hello, how are you?" })
  @IsString()
  content: string;
}

export class VerboseImageUrlDto {
  @ApiProperty({ example: "https://example.com/image.jpg" })
  @IsString()
  url: string;
}

export class VerboseImageContentDto {
  @ApiProperty({ enum: ["image_url"], example: "image_url" })
  @IsEnum(["image_url"])
  type: "image_url";

  @ApiProperty({ type: VerboseImageUrlDto })
  @ValidateNested()
  @Type(() => VerboseImageUrlDto)
  image_url: VerboseImageUrlDto;
}

export class VerboseFileContentDto {
  @ApiProperty({ enum: ["file"], example: "file" })
  @IsEnum(["file"])
  type: "file";

  @ApiProperty({
    type: "object",
    properties: {
      filename: { type: "string" },
      file_data: { type: "string" },
    },
  })
  @IsObject()
  file: {
    filename: string;
    file_data: string;
  };
}

/**
 * Сообщение для OpenRouter
 */
export class OpenRouterMessageDto {
  @ApiProperty({
    enum: ["system", "user", "assistant"],
    example: "user",
    description: "Роль отправителя сообщения",
  })
  @IsEnum(["system", "user", "assistant"])
  role: "system" | "user" | "assistant";

  @ApiProperty({
    oneOf: [
      { type: "string" },
      {
        type: "array",
        items: {
          oneOf: [
            { $ref: "#/components/schemas/VerboseTextContentDto" },
            { $ref: "#/components/schemas/VerboseImageContentDto" },
            { $ref: "#/components/schemas/VerboseFileContentDto" },
          ],
        },
      },
    ],
    example: "Hello, world!",
    description: "Содержимое сообщения (строка или массив объектов контента)",
  })
  @IsNotEmpty()
  @ValidateIf((o) => typeof o.content === "string")
  @IsString()
  @ValidateIf((o) => Array.isArray(o.content))
  @IsArray()
  content:
    | string
    | (
        | VerboseTextContentDto
        | VerboseImageContentDto
        | VerboseFileContentDto
      )[];
}

/**
 * Настройки провайдера
 */
export class ProviderConfigDto {
  @ApiPropertyOptional({
    type: [String],
    example: ["DeepInfra", "Hyperbolic"],
    description: "Список разрешенных провайдеров",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  only?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ["DeepInfra", "Hyperbolic"],
    description: "Порядок предпочтения провайдеров",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  order?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ["ProviderToIgnore"],
    description: "Список игнорируемых провайдеров",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignore?: string[];

  @ApiPropertyOptional({
    type: [String],
    enum: ["int4", "int8", "fp6", "fp8", "fp16", "bf16", "unknown"],
    description: "Допустимые квантизации",
  })
  @IsOptional()
  @IsArray()
  quantizations?: (
    | "int4"
    | "int8"
    | "fp6"
    | "fp8"
    | "fp16"
    | "bf16"
    | "unknown"
  )[];

  @ApiPropertyOptional({
    enum: ["allow", "deny"],
    description: "Политика сбора данных",
  })
  @IsOptional()
  @IsEnum(["allow", "deny"])
  data_collection?: "allow" | "deny";

  @ApiPropertyOptional({
    type: Boolean,
    description: "Разрешить откат к альтернативным провайдерам",
  })
  @IsOptional()
  @IsBoolean()
  allow_fallbacks?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Требовать параметры от провайдера",
  })
  @IsOptional()
  @IsBoolean()
  require_parameters?: boolean;
}

/**
 * Настройки reasoning (для моделей с рассуждением)
 */
export class ReasoningConfigDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: "Исключить reasoning из ответа",
  })
  @IsOptional()
  @IsBoolean()
  exclude?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Включить reasoning",
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: ["high", "medium", "low"],
    description: "Уровень усилий для reasoning",
  })
  @IsOptional()
  @IsEnum(["high", "medium", "low"])
  effort?: "high" | "medium" | "low";

  @ApiPropertyOptional({
    type: Number,
    description: "Максимальное количество токенов для reasoning",
  })
  @IsOptional()
  @IsNumber()
  max_tokens?: number;
}

/**
 * Конфигурация запроса к OpenRouter
 */
export class OpenRouterConfigDto {
  @ApiPropertyOptional({
    type: String,
    example: "meta-llama/llama-3.3-70b-instruct",
    description: "ID модели OpenRouter",
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 0.7,
    minimum: 0,
    maximum: 2,
    description: "Температура генерации (0-2)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 0.05,
    minimum: 0,
    maximum: 1,
    description: "Min-p параметр (0-1)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  min_p?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 1000,
    minimum: 1,
    description: "Максимальное количество токенов в ответе",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 1,
    description: "Top-a параметр (0-1)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_a?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 1,
    description: "Top-p параметр (0-1)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    description: "Top-k параметр (>= 1, не для OpenAI моделей)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  top_k?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: -2,
    maximum: 2,
    description: "Штраф за частоту (-2 до 2)",
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequency_penalty?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: -2,
    maximum: 2,
    description: "Штраф за присутствие (-2 до 2)",
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presence_penalty?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 2,
    description: "Штраф за повторения (0-2)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  repetition_penalty?: number;

  @ApiPropertyOptional({
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    description: "Стоп-последовательности",
  })
  @IsOptional()
  stop?: string | string[];

  @ApiPropertyOptional({
    type: ProviderConfigDto,
    description: "Настройки провайдера",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider?: ProviderConfigDto;

  @ApiPropertyOptional({
    type: ReasoningConfigDto,
    description: "Настройки reasoning",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReasoningConfigDto)
  reasoning?: ReasoningConfigDto;

  @ApiPropertyOptional({
    type: Boolean,
    description: "Включить стриминг",
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiPropertyOptional({
    type: String,
    description: "HTTP Referer для запроса",
  })
  @IsOptional()
  @IsString()
  httpReferer?: string;

  @ApiPropertyOptional({
    type: String,
    description: "X-Title для запроса",
  })
  @IsOptional()
  @IsString()
  xTitle?: string;
}

/**
 * Запрос к OpenRouter chat completions
 */
export class OpenRouterChatRequestDto extends OpenRouterConfigDto {
  @ApiProperty({
    type: [OpenRouterMessageDto],
    description: "Массив сообщений для обработки",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenRouterMessageDto)
  messages: OpenRouterMessageDto[];
}

/**
 * Использование токенов
 */
export class ResponseUsageDto {
  @ApiProperty({ example: 10, description: "Количество токенов в запросе" })
  prompt_tokens: number;

  @ApiProperty({
    example: 50,
    description: "Количество сгенерированных токенов",
  })
  completion_tokens: number;

  @ApiProperty({ example: 60, description: "Общее количество токенов" })
  total_tokens: number;
}

/**
 * Выбор ответа (без стриминга)
 */
export class ResponseChoiceDto {
  @ApiProperty({
    example: "stop",
    description: "Причина завершения генерации",
    nullable: true,
  })
  finish_reason: string | null;

  @ApiProperty({
    type: "object",
    properties: {
      content: { type: "string", nullable: true },
      role: { type: "string" },
      reasoning: { type: "string", nullable: true },
    },
    description: "Сообщение от модели",
  })
  message: {
    content: string | null;
    role: string;
    reasoning: string | null;
  };
}

/**
 * Успешный ответ от OpenRouter
 */
export class OpenRouterResponseDto {
  @ApiProperty({ example: "gen-123456", description: "ID генерации" })
  id: string;

  @ApiProperty({
    type: [ResponseChoiceDto],
    description: "Массив вариантов ответа",
  })
  choices: ResponseChoiceDto[];

  @ApiProperty({ example: 1699999999, description: "Unix timestamp создания" })
  created: number;

  @ApiProperty({
    example: "meta-llama/llama-3.3-70b-instruct",
    description: "Использованная модель",
  })
  model: string;

  @ApiPropertyOptional({
    type: String,
    description: "Отпечаток системы (если поддерживается провайдером)",
  })
  system_fingerprint?: string;

  @ApiPropertyOptional({
    type: ResponseUsageDto,
    description: "Информация об использовании токенов",
  })
  usage?: ResponseUsageDto;
}

/**
 * Ответ с ошибкой от OpenRouter
 */
export class OpenRouterErrorResponseDto {
  @ApiProperty({
    type: "object",
    properties: {
      status: { type: "number" },
      message: { type: "string" },
      metadata: { type: "object" },
    },
    description: "Информация об ошибке",
  })
  error: {
    status: number;
    message: string;
    metadata?: unknown;
  };
}

/**
 * Статистика генерации
 */
export class GenerationStatsDto {
  @ApiProperty({
    type: "object",
    properties: {
      id: { type: "string" },
      model: { type: "string" },
      streamed: { type: "boolean" },
      generation_time: { type: "number" },
      created_at: { type: "string", format: "date-time" },
      tokens_prompt: { type: "number" },
      tokens_completion: { type: "number" },
      native_tokens_prompt: { type: "number" },
      native_tokens_completion: { type: "number" },
      num_media_prompt: { type: "number", nullable: true },
      num_media_completion: { type: "number", nullable: true },
      origin: { type: "string" },
      total_cost: { type: "number" },
      cache_discount: { type: "number", nullable: true },
    },
  })
  data: {
    id: string;
    model: string;
    streamed: boolean;
    generation_time: number;
    created_at: Date;
    tokens_prompt: number;
    tokens_completion: number;
    native_tokens_prompt: number;
    native_tokens_completion: number;
    num_media_prompt: null | number;
    num_media_completion: null | number;
    origin: string;
    total_cost: number;
    cache_discount: null | number;
  };
}

/**
 * Информация о ценах модели
 */
export class ModelPricingDto {
  @ApiProperty({ example: "0", description: "Цена за токен промпта" })
  prompt: string;

  @ApiProperty({ example: "0", description: "Цена за токен завершения" })
  completion: string;

  @ApiPropertyOptional({
    example: "0",
    description: "Цена за изображение в промпте",
  })
  image?: string;

  @ApiPropertyOptional({ example: "0", description: "Цена за запрос" })
  request?: string;
}

/**
 * Архитектура модели
 */
export class ModelArchitectureDto {
  @ApiProperty({ example: "llama", description: "Тип архитектуры модели" })
  modality: string;

  @ApiProperty({ example: "text->text", description: "Тип токенизатора" })
  tokenizer: string;

  @ApiProperty({ example: "decoder-only", description: "Тип instruct" })
  instruct_type: string | null;
}

/**
 * Детальная информация о модели OpenRouter
 */
export class OpenRouterModelDto {
  @ApiProperty({
    example: "meta-llama/llama-3.3-70b-instruct:free",
    description: "Уникальный ID модели",
  })
  id: string;

  @ApiProperty({
    example: "Meta Llama 3.3 70B Instruct (free)",
    description: "Название модели",
  })
  name: string;

  @ApiPropertyOptional({
    example: "Meta's latest Llama model",
    description: "Описание модели",
  })
  description?: string;

  @ApiProperty({
    type: ModelPricingDto,
    description: "Информация о ценах",
  })
  pricing: ModelPricingDto;

  @ApiProperty({
    example: 131072,
    description: "Размер контекстного окна",
  })
  context_length: number;

  @ApiProperty({
    type: ModelArchitectureDto,
    description: "Архитектура модели",
  })
  architecture: ModelArchitectureDto;

  @ApiPropertyOptional({
    example: "https://meta.ai",
    description: "Ссылка на информацию о модели",
  })
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated: boolean;
  };

  @ApiProperty({
    example: 4096,
    description: "Максимальное количество токенов в ответе",
  })
  max_completion_tokens?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ["DeepInfra", "Hyperbolic"],
    description: "Список поддерживаемых провайдеров",
  })
  supported_providers?: string[];

  @ApiPropertyOptional({
    example: 70000000000,
    description: "Количество параметров модели",
  })
  num_parameters?: number;
}

/**
 * Ответ со списком моделей
 */
export class ModelsListResponseDto {
  @ApiProperty({
    type: [OpenRouterModelDto],
    description: "Список моделей",
  })
  data: OpenRouterModelDto[];
}
