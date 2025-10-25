import { ApiProperty } from "@nestjs/swagger";

export class BotResponseDto {
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
    description: "Описание бота",
    example: "Бот для обработки заявок",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Токен бота",
    example: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  })
  token: string;

  @ApiProperty({
    description: "Активен ли бот",
    example: true,
  })
  isActive: boolean;

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

  @ApiProperty({
    description: "ID пользователя-владельца",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "Включен ли магазин",
    example: false,
    required: false,
  })
  isShop?: boolean;

  @ApiProperty({
    description: "URL логотипа магазина",
    example: "https://example.com/logo.png",
    required: false,
  })
  shopLogoUrl?: string;

  @ApiProperty({
    description: "Заголовок магазина",
    example: "Мой магазин",
    required: false,
  })
  shopTitle?: string;

  @ApiProperty({
    description: "Описание магазина",
    example: "Добро пожаловать в наш магазин!",
    required: false,
  })
  shopDescription?: string;

  @ApiProperty({
    description: "Кастомные CSS стили для магазина",
    example:
      ".shop-header { background: linear-gradient(45deg, #ff6b6b, #4ecdc4); }",
    required: false,
  })
  shopCustomStyles?: string;

  @ApiProperty({
    description: "Типы кнопок магазина",
    example: ["menu_button", "main_app", "command"],
    required: false,
  })
  shopButtonTypes?: string[];

  @ApiProperty({
    description: "Настройки для разных типов кнопок",
    example: {
      menu_button: { text: "Магазин" },
      inline_button: { text: "🛒 Купить" },
    },
    required: false,
  })
  shopButtonSettings?: Record<string, any>;
}

export class BotStatsResponseDto {
  @ApiProperty({
    description: "Общее количество сообщений",
    example: 1250,
  })
  totalMessages: number;

  @ApiProperty({
    description: "Количество активных пользователей",
    example: 45,
  })
  activeUsers: number;

  @ApiProperty({
    description: "Количество новых пользователей за последние 24 часа",
    example: 3,
  })
  newUsersLast24h: number;

  @ApiProperty({
    description: "Количество сообщений за последние 24 часа",
    example: 25,
  })
  messagesLast24h: number;

  @ApiProperty({
    description: "Дата последней активности",
    example: "2024-01-15T10:30:00.000Z",
  })
  lastActivity: Date;
}
