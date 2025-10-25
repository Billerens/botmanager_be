import { ApiProperty } from "@nestjs/swagger";

export class TelegramWebhookResponseDto {
  @ApiProperty({
    description: "Статус обработки webhook",
    example: true,
  })
  ok: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке (если есть)",
    example: "Bot not found",
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: "Дополнительная информация о обработке",
    example: {
      processedMessages: 1,
      processedCallbacks: 0,
      processedEditedMessages: 0,
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class TelegramBotInfoResponseDto {
  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название бота",
    example: "Мой Telegram бот",
  })
  name: string;

  @ApiProperty({
    description: "Токен бота",
    example: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  })
  token: string;

  @ApiProperty({
    description: "Статус бота",
    example: "active",
  })
  status: string;

  @ApiProperty({
    description: "Username бота в Telegram",
    example: "my_bot",
  })
  username: string;

  @ApiProperty({
    description: "Информация о боте от Telegram API",
    example: {
      id: 1234567890,
      is_bot: true,
      first_name: "Мой бот",
      username: "my_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    },
    required: false,
  })
  telegramInfo?: Record<string, any>;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class TelegramMessageResponseDto {
  @ApiProperty({
    description: "ID сообщения",
    example: 12345,
  })
  messageId: number;

  @ApiProperty({
    description: "ID чата",
    example: 67890,
  })
  chatId: number;

  @ApiProperty({
    description: "Тип чата",
    example: "private",
  })
  chatType: string;

  @ApiProperty({
    description: "Текст сообщения",
    example: "Привет! Как дела?",
    required: false,
  })
  text?: string;

  @ApiProperty({
    description: "Тип сообщения",
    example: "text",
  })
  messageType: string;

  @ApiProperty({
    description: "Информация об отправителе",
    example: {
      id: 123456789,
      is_bot: false,
      first_name: "Иван",
      last_name: "Петров",
      username: "ivan_petrov",
      language_code: "ru",
    },
  })
  from: Record<string, any>;

  @ApiProperty({
    description: "Дата отправки",
    example: "2024-01-15T10:30:00.000Z",
  })
  date: Date;

  @ApiProperty({
    description: "Дополнительные данные сообщения",
    example: {
      entities: [],
      reply_to_message: null,
      forward_from: null,
    },
    required: false,
  })
  metadata?: Record<string, any>;
}

export class TelegramCallbackResponseDto {
  @ApiProperty({
    description: "ID callback query",
    example: "1234567890",
  })
  id: string;

  @ApiProperty({
    description: "Информация об отправителе",
    example: {
      id: 123456789,
      is_bot: false,
      first_name: "Иван",
      last_name: "Петров",
      username: "ivan_petrov",
    },
  })
  from: Record<string, any>;

  @ApiProperty({
    description: "Сообщение, к которому привязан callback",
    example: {
      message_id: 12345,
      chat: {
        id: 67890,
        type: "private",
      },
    },
  })
  message: Record<string, any>;

  @ApiProperty({
    description: "Данные callback",
    example: "button_clicked",
  })
  data: string;

  @ApiProperty({
    description: "Дата callback",
    example: "2024-01-15T10:30:00.000Z",
  })
  date: Date;
}
