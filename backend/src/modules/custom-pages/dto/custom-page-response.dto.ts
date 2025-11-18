import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CustomPageStatus } from "../../../database/entities/custom-page.entity";

export class CustomPageResponseDto {
  @ApiProperty({
    description: "ID страницы",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название страницы",
    example: "Контакты",
  })
  title: string;

  @ApiProperty({
    description: "URL-friendly идентификатор страницы (slug)",
    example: "contacts",
  })
  slug: string;

  @ApiPropertyOptional({
    description: "Описание страницы",
    example: "Свяжитесь с нами",
  })
  description?: string;

  @ApiProperty({
    description: "HTML/Markdown контент страницы",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  content: string;

  @ApiProperty({
    description: "Статус страницы",
    example: CustomPageStatus.ACTIVE,
    enum: CustomPageStatus,
  })
  status: CustomPageStatus;

  @ApiProperty({
    description: "Открывать только в Telegram WebApp",
    example: false,
  })
  isWebAppOnly: boolean;

  @ApiPropertyOptional({
    description: "Команда в боте для вызова страницы",
    example: "contacts",
  })
  botCommand?: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Username бота",
    example: "my_restaurant_bot",
  })
  botUsername: string;

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
    description: "Полный URL страницы",
    example: "https://botmanagertest.online/my_restaurant_bot/contacts",
  })
  url: string;
}

export class PublicCustomPageResponseDto {
  @ApiProperty({
    description: "ID страницы",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название страницы",
    example: "Контакты",
  })
  title: string;

  @ApiProperty({
    description: "URL-friendly идентификатор страницы (slug)",
    example: "contacts",
  })
  slug: string;

  @ApiPropertyOptional({
    description: "Описание страницы",
    example: "Свяжитесь с нами",
  })
  description?: string;

  @ApiProperty({
    description: "HTML/Markdown контент страницы",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  content: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Username бота",
    example: "my_restaurant_bot",
  })
  botUsername: string;

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
    description: "Полный URL страницы",
    example: "https://botmanagertest.online/my_restaurant_bot/contacts",
  })
  url: string;

  @ApiProperty({
    description: "Открывать только в Telegram WebApp",
    example: false,
  })
  isWebAppOnly: boolean;
}
