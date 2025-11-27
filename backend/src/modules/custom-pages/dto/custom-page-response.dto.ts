import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CustomPageStatus,
  CustomPageType,
  CustomPageAsset,
} from "../../../database/entities/custom-page.entity";

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
    description: "Тип страницы: inline (HTML в БД) или static (файлы в S3)",
    example: CustomPageType.INLINE,
    enum: CustomPageType,
  })
  pageType: CustomPageType;

  @ApiPropertyOptional({
    description: "HTML/Markdown контент страницы (для inline режима)",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  content?: string;

  @ApiPropertyOptional({
    description: "Путь к папке в S3 (для static режима)",
    example: "custom-pages/123e4567-e89b-12d3-a456-426614174000",
  })
  staticPath?: string;

  @ApiProperty({
    description: "Точка входа для static режима",
    example: "index.html",
  })
  entryPoint: string;

  @ApiPropertyOptional({
    description: "Список файлов для static режима",
    type: "array",
    items: {
      type: "object",
      properties: {
        fileName: { type: "string", example: "index.html" },
        s3Key: {
          type: "string",
          example: "custom-pages/123e4567/index.html",
        },
        size: { type: "number", example: 1024 },
        mimeType: { type: "string", example: "text/html" },
      },
    },
  })
  assets?: CustomPageAsset[];

  @ApiPropertyOptional({
    description: "URL для доступа к статическим файлам (для static режима)",
    example: "https://s3.example.com/bucket/custom-pages/123e4567",
  })
  staticUrl?: string;

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
    description: "Тип страницы: inline (HTML в БД) или static (файлы в S3)",
    example: CustomPageType.INLINE,
    enum: CustomPageType,
  })
  pageType: CustomPageType;

  @ApiPropertyOptional({
    description: "HTML/Markdown контент страницы (для inline режима)",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  content?: string;

  @ApiPropertyOptional({
    description: "URL для доступа к статическим файлам (для static режима)",
    example: "https://s3.example.com/bucket/custom-pages/123e4567",
  })
  staticUrl?: string;

  @ApiProperty({
    description: "Точка входа для static режима",
    example: "index.html",
  })
  entryPoint: string;

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
