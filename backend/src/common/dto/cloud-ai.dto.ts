import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsObject,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

// ==================== Agent Call DTOs ====================

export class AgentCallDto {
  @ApiProperty({
    description: "Сообщение для отправки агенту",
    example: "Привет, как дела?",
  })
  @IsString()
  message: string;

  @ApiProperty({
    description:
      "Опциональный ID родительского сообщения для контекста разговора",
    required: false,
  })
  @IsOptional()
  @IsString()
  parent_message_id?: string;
}

export class AgentCallResponseDto {
  @ApiProperty({
    description: "Ответное сообщение от агента",
  })
  message: string;

  @ApiProperty({
    description: "Уникальный ID сообщения",
  })
  id: string;

  @ApiProperty({
    description: "Причина завершения ответа",
  })
  finish_reason: any;
}

// ==================== Chat Completions DTOs ====================

export class TextContentDto {
  @ApiProperty({ enum: ["text"], example: "text" })
  @IsEnum(["text"])
  type: "text";

  @ApiProperty({ example: "What is in this image?" })
  @IsString()
  text: string;
}

export class ImageUrlDto {
  @ApiProperty({ example: "https://example.com/image.jpg" })
  @IsString()
  url: string;

  @ApiProperty({
    enum: ["low", "high", "auto"],
    required: false,
    example: "auto",
  })
  @IsOptional()
  @IsEnum(["low", "high", "auto"])
  detail?: "low" | "high" | "auto";
}

export class ImageUrlContentDto {
  @ApiProperty({ enum: ["image_url"], example: "image_url" })
  @IsEnum(["image_url"])
  type: "image_url";

  @ApiProperty({ type: ImageUrlDto })
  @ValidateNested()
  @Type(() => ImageUrlDto)
  image_url: ImageUrlDto;
}

export class InputAudioDto {
  @ApiProperty({
    description: "Base64 encoded audio data",
    example:
      "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7bllHgU7jdXzzn0uBSF+zO/eizEIHWq+8+OWT",
  })
  @IsString()
  data: string;

  @ApiProperty({
    enum: ["wav", "mp3", "m4a", "ogg", "flac", "webm"],
    example: "wav",
  })
  @IsEnum(["wav", "mp3", "m4a", "ogg", "flac", "webm"])
  format: "wav" | "mp3" | "m4a" | "ogg" | "flac" | "webm";
}

export class InputAudioContentDto {
  @ApiProperty({ enum: ["input_audio"], example: "input_audio" })
  @IsEnum(["input_audio"])
  type: "input_audio";

  @ApiProperty({ type: InputAudioDto })
  @ValidateNested()
  @Type(() => InputAudioDto)
  input_audio: InputAudioDto;
}

export type ChatMessageContent =
  | string
  | Array<TextContentDto | ImageUrlContentDto | InputAudioContentDto>;

export class ChatMessageDto {
  @ApiProperty({
    enum: ["system", "user", "assistant", "tool", "function", "developer"],
    example: "user",
  })
  @IsEnum(["system", "user", "assistant", "tool", "function", "developer"])
  role: "system" | "user" | "assistant" | "tool" | "function" | "developer";

  @ApiProperty({
    description:
      "Содержимое сообщения - может быть строкой или массивом элементов контента",
    oneOf: [
      { type: "string" },
      {
        type: "array",
        items: {
          oneOf: [
            { $ref: "#/components/schemas/TextContentDto" },
            { $ref: "#/components/schemas/ImageUrlContentDto" },
            { $ref: "#/components/schemas/InputAudioContentDto" },
          ],
        },
      },
    ],
  })
  content: ChatMessageContent;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  name?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  function_call?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  tool_calls?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  tool_call_id?: any;
}

export class StreamOptionsDto {
  @ApiProperty({
    description:
      "Включать ли информацию об использовании в стриминговых ответах",
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  include_usage?: boolean;
}

export class ChatCompletionCreateParamsDto {
  @ApiProperty({
    description:
      "ID модели для использования. Это поле игнорируется, так как агент имеет свою конфигурацию модели.",
    required: false,
    example: "gpt-4",
  })
  @IsOptional()
  @IsObject()
  model?: any;

  @ApiProperty({
    description: "Список сообщений, составляющих разговор",
    type: [ChatMessageDto],
  })
  @IsArray({ message: "messages must be an array" })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiProperty({
    description:
      "Температура выборки, от 0 до 2. Более высокие значения делают вывод более случайным",
    required: false,
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({
    description: "Nucleus sampling - альтернатива temperature",
    required: false,
    example: 1,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number;

  @ApiProperty({
    description: "Количество вариантов ответа для каждого входного сообщения",
    required: false,
    example: 1,
    minimum: 1,
    maximum: 128,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128)
  n?: number;

  @ApiProperty({
    description: "Стримить ли частичные ответы",
    required: false,
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiProperty({
    description: "До 4 последовательностей, где API остановит генерацию",
    required: false,
    example: ["\n", "Human:"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stop?: string | string[];

  @ApiProperty({
    description: "Максимальное количество токенов для генерации (устарело)",
    required: false,
    example: 100,
    minimum: 1,
    deprecated: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @ApiProperty({
    description: "Максимальное количество токенов для генерации",
    required: false,
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_completion_tokens?: number;

  @ApiProperty({
    description: "Штраф за присутствие, от -2.0 до 2.0",
    required: false,
    example: 0,
    minimum: -2,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presence_penalty?: number;

  @ApiProperty({
    description: "Штраф за частоту, от -2.0 до 2.0",
    required: false,
    example: 0,
    minimum: -2,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequency_penalty?: number;

  @ApiProperty({
    description: "Изменение вероятности появления указанных токенов",
    required: false,
    example: { "50256": -100 },
  })
  @IsOptional()
  @IsObject()
  logit_bias?: Record<string, number>;

  @ApiProperty({
    description: "Уникальный идентификатор конечного пользователя",
    required: false,
    example: "user-1234",
  })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty({
    description: "Опции для стримингового ответа",
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StreamOptionsDto)
  stream_options?: StreamOptionsDto;

  @ApiProperty({
    description: "Возвращать ли логарифмические вероятности выходных токенов",
    required: false,
    example: false,
  })
  @IsOptional()
  @IsObject()
  logprobs?: any;

  @ApiProperty({
    description:
      "Количество наиболее вероятных токенов для возврата на каждой позиции",
    required: false,
    example: 0,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  top_logprobs?: number;
}

export class OpenAiChatCompletionMessageDto {
  @ApiProperty({ example: "user" })
  role: string;

  @ApiProperty({ example: "Hello, how are you?" })
  content: string;
}

export class OpenAiChatCompletionChoiceDto {
  @ApiProperty({ example: 0 })
  index: number;

  @ApiProperty({ type: OpenAiChatCompletionMessageDto })
  message: OpenAiChatCompletionMessageDto;

  @ApiProperty({
    enum: ["stop", "length", "content_filter", "tool_calls"],
    example: "stop",
  })
  finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
}

export class OpenAiUsageDto {
  @ApiProperty({ example: 10 })
  prompt_tokens: number;

  @ApiProperty({ example: 50 })
  completion_tokens: number;

  @ApiProperty({ example: 60 })
  total_tokens: number;
}

export class OpenAiChatCompletionResponseDto {
  @ApiProperty({ example: "chatcmpl-123" })
  id: string;

  @ApiProperty({ example: "chat.completion" })
  object: string;

  @ApiProperty({ example: 1692901427 })
  created: number;

  @ApiProperty({ example: "gpt-4" })
  model: string;

  @ApiProperty({ type: [OpenAiChatCompletionChoiceDto] })
  choices: OpenAiChatCompletionChoiceDto[];

  @ApiProperty({ type: OpenAiUsageDto })
  usage: OpenAiUsageDto;

  @ApiProperty({ required: false })
  system_fingerprint?: string;
}

// ==================== Text Completions DTOs (Legacy) ====================

export class OpenAiTextCompletionRequestDto {
  @ApiProperty({
    description: "Промпт для генерации завершений",
    example: "Write a short story about a robot",
  })
  @IsString()
  prompt: string;

  @ApiProperty({
    description: "Модель для использования",
    example: "gpt-3.5-turbo-instruct",
    default: "gpt-3.5-turbo-instruct",
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    description: "Максимальное количество токенов для генерации",
    example: 100,
    minimum: 1,
    maximum: 4096,
    default: 16,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4096)
  max_tokens?: number;

  @ApiProperty({
    description: "Контролирует случайность вывода",
    example: 0.7,
    minimum: 0,
    maximum: 2,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({
    description: "Контролирует разнообразие через nucleus sampling",
    example: 0.9,
    minimum: 0,
    maximum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number;

  @ApiProperty({
    description: "Сколько завершений генерировать",
    example: 1,
    minimum: 1,
    maximum: 128,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128)
  n?: number;

  @ApiProperty({
    description: "Стримить ли частичный прогресс",
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiProperty({
    description: "Включить логарифмические вероятности",
    required: false,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  logprobs?: number;

  @ApiProperty({
    description: "Эхо-ответ с промптом",
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  echo?: boolean;

  @ApiProperty({
    description: "До 4 последовательностей, где API остановит генерацию",
    required: false,
    example: ["\n"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stop?: string[];

  @ApiProperty({
    description: "Штраф за присутствие, от -2.0 до 2.0",
    example: 0,
    minimum: -2,
    maximum: 2,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  presence_penalty?: number;

  @ApiProperty({
    description: "Штраф за частоту, от -2.0 до 2.0",
    example: 0,
    minimum: -2,
    maximum: 2,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-2)
  @Max(2)
  frequency_penalty?: number;

  @ApiProperty({
    description: "Генерирует best_of завершений на сервере и возвращает лучшее",
    example: 1,
    minimum: 1,
    maximum: 20,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  best_of?: number;

  @ApiProperty({
    description: "Уникальный идентификатор конечного пользователя",
    example: "user-123",
    required: false,
  })
  @IsOptional()
  @IsString()
  user?: string;
}

export class TextCompletionChoice {
  @ApiProperty({ example: "Once upon a time, there was a robot..." })
  text: string;

  @ApiProperty({ example: 0 })
  index: number;

  @ApiProperty({ required: false })
  logprobs?: any;

  @ApiProperty({
    enum: ["stop", "length", "content_filter"],
    example: "stop",
  })
  finish_reason: "stop" | "length" | "content_filter";
}

export class TextCompletionUsage {
  @ApiProperty({ example: 10 })
  prompt_tokens: number;

  @ApiProperty({ example: 50 })
  completion_tokens: number;

  @ApiProperty({ example: 60 })
  total_tokens: number;
}

export class OpenAiTextCompletionResponseDto {
  @ApiProperty({ example: "cmpl-7QyqpwdfhqwajicIEznoc6Q47XAyW" })
  id: string;

  @ApiProperty({ example: "text_completion" })
  object: string;

  @ApiProperty({ example: 1692901427 })
  created: number;

  @ApiProperty({ example: "gpt-3.5-turbo-instruct" })
  model: string;

  @ApiProperty({ type: [TextCompletionChoice] })
  choices: TextCompletionChoice[];

  @ApiProperty({ type: TextCompletionUsage })
  usage: TextCompletionUsage;
}

// ==================== Models DTOs ====================

export class OpenAiModelDto {
  @ApiProperty({ example: "gpt-4o-2024-08-06" })
  id: string;

  @ApiProperty({ example: "model" })
  object: string;

  @ApiProperty({ example: 1692901427 })
  created: number;

  @ApiProperty({ example: "openai" })
  owned_by: string;
}

export class OpenAiModelsResponseDto {
  @ApiProperty({ example: "list" })
  object: string;

  @ApiProperty({ type: [OpenAiModelDto] })
  data: OpenAiModelDto[];
}
