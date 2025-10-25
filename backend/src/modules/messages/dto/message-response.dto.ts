import { ApiProperty } from "@nestjs/swagger";

export class MessageResponseDto {
  @ApiProperty({
    description: "ID сообщения",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  telegramUserId: string;

  @ApiProperty({
    description: "Тип сообщения",
    example: "text",
  })
  messageType: string;

  @ApiProperty({
    description: "Содержимое сообщения",
    example: "Привет! Как дела?",
  })
  content: string;

  @ApiProperty({
    description: "Направление сообщения",
    example: "incoming",
  })
  direction: string;

  @ApiProperty({
    description: "Статус сообщения",
    example: "sent",
  })
  status: string;

  @ApiProperty({
    description: "Дополнительные данные сообщения",
    example: {
      messageId: 12345,
      chatId: 67890,
      replyToMessageId: 11111,
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class BroadcastResponseDto {
  @ApiProperty({
    description: "ID рассылки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Название рассылки",
    example: "Новогодняя акция",
  })
  name: string;

  @ApiProperty({
    description: "Содержимое рассылки",
    example: "Специальное предложение на Новый год!",
  })
  content: string;

  @ApiProperty({
    description: "Тип контента",
    example: "text",
  })
  contentType: string;

  @ApiProperty({
    description: "Статус рассылки",
    example: "scheduled",
  })
  status: string;

  @ApiProperty({
    description: "Количество получателей",
    example: 150,
  })
  recipientCount: number;

  @ApiProperty({
    description: "Количество отправленных сообщений",
    example: 120,
  })
  sentCount: number;

  @ApiProperty({
    description: "Количество доставленных сообщений",
    example: 115,
  })
  deliveredCount: number;

  @ApiProperty({
    description: "Дата планируемой отправки",
    example: "2024-01-20T12:00:00.000Z",
    required: false,
  })
  scheduledAt?: Date;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: "Статус ошибки",
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке",
    example: "Unauthorized access",
  })
  message: string;

  @ApiProperty({
    description: "Код ошибки",
    example: "UNAUTHORIZED",
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: "Дополнительные детали ошибки",
    example: {
      timestamp: "2024-01-15T10:30:00.000Z",
      path: "/api/messages/bot/123",
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class MessageStatsResponseDto {
  @ApiProperty({
    description: "Общее количество сообщений",
    example: 5000,
  })
  totalMessages: number;

  @ApiProperty({
    description: "Количество входящих сообщений",
    example: 2500,
  })
  incomingMessages: number;

  @ApiProperty({
    description: "Количество исходящих сообщений",
    example: 2500,
  })
  outgoingMessages: number;

  @ApiProperty({
    description: "Количество сообщений за последние 24 часа",
    example: 150,
  })
  messagesLast24h: number;

  @ApiProperty({
    description: "Количество уникальных пользователей",
    example: 300,
  })
  uniqueUsers: number;

  @ApiProperty({
    description: "Среднее количество сообщений на пользователя",
    example: 16.7,
  })
  averageMessagesPerUser: number;
}

export class DialogResponseDto {
  @ApiProperty({
    description: "ID чата",
    example: "123456789",
  })
  chatId: string;

  @ApiProperty({
    description: "Тип чата",
    example: "private",
  })
  chatType: string;

  @ApiProperty({
    description: "Информация о пользователе",
    example: {
      id: 123456789,
      firstName: "Иван",
      lastName: "Петров",
      username: "ivan_petrov",
    },
  })
  user: Record<string, any>;

  @ApiProperty({
    description: "Количество сообщений в диалоге",
    example: 25,
  })
  messageCount: number;

  @ApiProperty({
    description: "Дата последней активности",
    example: "2024-01-15T10:30:00.000Z",
  })
  lastActivity: Date;

  @ApiProperty({
    description: "Последнее сообщение",
    example: "Спасибо за помощь!",
    required: false,
  })
  lastMessage?: string;

  @ApiProperty({
    description: "Дата создания диалога",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;
}

export class GroupResponseDto {
  @ApiProperty({
    description: "ID группы",
    example: "-1001234567890",
  })
  chatId: string;

  @ApiProperty({
    description: "Название группы",
    example: "Моя группа",
  })
  title: string;

  @ApiProperty({
    description: "Тип чата",
    example: "group",
  })
  chatType: string;

  @ApiProperty({
    description: "Количество участников",
    example: 150,
  })
  memberCount: number;

  @ApiProperty({
    description: "Количество сообщений в группе",
    example: 1250,
  })
  messageCount: number;

  @ApiProperty({
    description: "Дата последней активности",
    example: "2024-01-15T10:30:00.000Z",
  })
  lastActivity: Date;

  @ApiProperty({
    description: "Последнее сообщение",
    example: "Привет всем!",
    required: false,
  })
  lastMessage?: string;

  @ApiProperty({
    description: "Дата создания группы",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;
}

export class UserResponseDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  telegramUserId: string;

  @ApiProperty({
    description: "Имя пользователя",
    example: "Иван",
  })
  firstName: string;

  @ApiProperty({
    description: "Фамилия пользователя",
    example: "Петров",
    required: false,
  })
  lastName?: string;

  @ApiProperty({
    description: "Username пользователя",
    example: "ivan_petrov",
    required: false,
  })
  username?: string;

  @ApiProperty({
    description: "Количество сообщений от пользователя",
    example: 45,
  })
  messageCount: number;

  @ApiProperty({
    description: "Дата последней активности",
    example: "2024-01-15T10:30:00.000Z",
  })
  lastActivity: Date;

  @ApiProperty({
    description: "Дата первого сообщения",
    example: "2024-01-01T00:00:00.000Z",
  })
  firstMessageAt: Date;
}

export class DialogStatsResponseDto {
  @ApiProperty({
    description: "Общее количество диалогов",
    example: 150,
  })
  totalDialogs: number;

  @ApiProperty({
    description: "Количество активных диалогов",
    example: 120,
  })
  activeDialogs: number;

  @ApiProperty({
    description: "Количество приватных чатов",
    example: 100,
  })
  privateChats: number;

  @ApiProperty({
    description: "Количество групповых чатов",
    example: 50,
  })
  groupChats: number;

  @ApiProperty({
    description: "Среднее количество сообщений на диалог",
    example: 25.5,
  })
  averageMessagesPerDialog: number;

  @ApiProperty({
    description: "Количество новых диалогов за последние 7 дней",
    example: 15,
  })
  newDialogsLast7Days: number;
}

export class BroadcastStatusResponseDto {
  @ApiProperty({
    description: "ID рассылки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Статус рассылки",
    example: "completed",
  })
  status: string;

  @ApiProperty({
    description: "Общее количество получателей",
    example: 1000,
  })
  totalRecipients: number;

  @ApiProperty({
    description: "Количество отправленных сообщений",
    example: 950,
  })
  sentCount: number;

  @ApiProperty({
    description: "Количество доставленных сообщений",
    example: 900,
  })
  deliveredCount: number;

  @ApiProperty({
    description: "Количество ошибок",
    example: 50,
  })
  errorCount: number;

  @ApiProperty({
    description: "Процент доставки",
    example: 94.7,
  })
  deliveryRate: number;

  @ApiProperty({
    description: "Дата завершения",
    example: "2024-01-15T10:30:00.000Z",
    required: false,
  })
  completedAt?: Date;
}
