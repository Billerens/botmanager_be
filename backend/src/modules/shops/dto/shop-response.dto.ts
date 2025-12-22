import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Информация о субдомене магазина
 */
export class SubdomainInfoDto {
  @ApiPropertyOptional({
    description: "Статус субдомена",
    enum: [
      "pending",
      "dns_creating",
      "ssl_issuing",
      "active",
      "dns_error",
      "ssl_error",
      "removing",
    ],
    example: "active",
  })
  status?: string;

  @ApiPropertyOptional({
    description: "URL субдомена",
    example: "myshop.shops.botmanagertest.online",
  })
  url?: string;

  @ApiPropertyOptional({
    description: "Сообщение об ошибке",
    example: null,
  })
  error?: string;

  @ApiPropertyOptional({
    description: "Дата активации субдомена",
    example: "2024-01-01T00:00:00.000Z",
  })
  activatedAt?: Date;
}

/**
 * DTO ответа для магазина
 */
export class ShopResponseDto {
  @ApiProperty({
    description: "ID магазина",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название магазина",
    example: "Мой магазин",
  })
  name: string;

  @ApiPropertyOptional({
    description: "Slug для субдомена",
    example: "myshop",
  })
  slug?: string;

  @ApiProperty({
    description: "ID владельца",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  ownerId: string;

  @ApiPropertyOptional({
    description: "ID привязанного бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId?: string;

  @ApiPropertyOptional({
    description: "URL логотипа",
    example: "https://example.com/logo.png",
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Заголовок магазина",
    example: "Магазин электроники",
  })
  title?: string;

  @ApiPropertyOptional({
    description: "Описание магазина",
    example: "Лучший магазин электроники",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "Кастомные CSS стили",
  })
  customStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок",
    example: ["command", "menu_button"],
  })
  buttonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки кнопок",
  })
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Конфигурация макета",
  })
  layoutConfig?: Record<string, any>;

  @ApiProperty({
    description: "Браузерный доступ включен",
    example: false,
  })
  browserAccessEnabled: boolean;

  @ApiProperty({
    description: "Требовать верификацию email",
    example: false,
  })
  browserAccessRequireEmailVerification: boolean;

  @ApiProperty({
    description: "URL магазина (стандартный)",
    example: "https://botmanagertest.online/shop/123e4567-e89b-12d3-a456-426614174000",
  })
  url: string;

  @ApiPropertyOptional({
    description: "Публичный URL магазина (субдомен если активен, иначе стандартный)",
    example: "https://myshop.shops.botmanagertest.online",
  })
  publicUrl?: string;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Информация о привязанном боте",
  })
  bot?: {
    id: string;
    name: string;
    username: string;
    status: string;
  };

  @ApiPropertyOptional({
    description: "Информация о субдомене (если slug установлен)",
    type: SubdomainInfoDto,
  })
  subdomain?: SubdomainInfoDto;
}

/**
 * DTO для публичных данных магазина (без чувствительной информации)
 */
export class PublicShopResponseDto {
  @ApiProperty({
    description: "ID магазина",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiPropertyOptional({
    description: "Название магазина",
    example: "Магазин электроники",
  })
  name?: string;

  @ApiPropertyOptional({
    description: "Заголовок магазина",
    example: "Магазин электроники",
  })
  title?: string;

  @ApiPropertyOptional({
    description: "Описание магазина",
    example: "Лучший магазин электроники",
  })
  description?: string;

  @ApiPropertyOptional({
    description: "URL логотипа",
    example: "https://example.com/logo.png",
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Кастомные CSS стили",
  })
  customStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок",
  })
  buttonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки кнопок",
  })
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Конфигурация макета",
  })
  layoutConfig?: Record<string, any>;

  @ApiProperty({
    description: "Браузерный доступ включен",
    example: true,
  })
  browserAccessEnabled: boolean;

  @ApiProperty({
    description: "URL магазина",
    example: "https://botmanagertest.online/shop/123e4567-e89b-12d3-a456-426614174000",
  })
  url: string;

  @ApiPropertyOptional({
    description: "Категории магазина",
  })
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    children?: any[];
  }>;

  @ApiPropertyOptional({
    description: "Username привязанного бота (для Telegram)",
    example: "myshop_bot",
  })
  botUsername?: string;
}

/**
 * DTO для списка магазинов
 */
export class ShopListResponseDto {
  @ApiProperty({
    description: "Список магазинов",
    type: [ShopResponseDto],
  })
  shops: ShopResponseDto[];

  @ApiProperty({
    description: "Общее количество магазинов",
    example: 10,
  })
  total: number;
}

/**
 * DTO для статистики магазина
 */
export class ShopStatsResponseDto {
  @ApiProperty({
    description: "Количество товаров",
    example: 100,
  })
  productsCount: number;

  @ApiProperty({
    description: "Количество категорий",
    example: 10,
  })
  categoriesCount: number;

  @ApiProperty({
    description: "Количество заказов",
    example: 50,
  })
  ordersCount: number;

  @ApiProperty({
    description: "Количество активных корзин",
    example: 5,
  })
  activeCartsCount: number;

  @ApiProperty({
    description: "Количество пользователей (браузерные)",
    example: 20,
  })
  publicUsersCount: number;
}

