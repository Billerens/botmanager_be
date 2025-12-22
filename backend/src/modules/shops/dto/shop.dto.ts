import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

/**
 * DTO для создания магазина
 */
export class CreateShopDto {
  @ApiProperty({
    description: "Название магазина (для системы управления)",
    example: "Мой магазин",
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Заголовок магазина (отображается пользователям)",
    example: "Магазин электроники",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: "Описание магазина",
    example: "Лучший магазин электроники в городе",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: "URL логотипа магазина",
    example: "https://example.com/logo.png",
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

/**
 * DTO для обновления магазина
 */
export class UpdateShopDto extends PartialType(CreateShopDto) {
  @ApiPropertyOptional({
    description: "Кастомные CSS стили",
    example: ":root { --primary-color: #ff0000; }",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  customStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок магазина",
    example: ["command", "menu_button"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buttonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки кнопок",
    example: { command: { text: "Магазин", description: "Открыть магазин" } },
  })
  @IsOptional()
  @IsObject()
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Конфигурация макета страниц магазина",
  })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Включить браузерный доступ",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  browserAccessEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Требовать верификацию email для браузерного доступа",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  browserAccessRequireEmailVerification?: boolean;
}

/**
 * DTO для привязки бота к магазину
 */
export class LinkBotDto {
  @ApiProperty({
    description: "ID бота для привязки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  botId: string;
}

/**
 * DTO для обновления настроек магазина (полная версия)
 */
export class UpdateShopSettingsDto {
  @ApiPropertyOptional({
    description:
      "Уникальный slug для публичного субдомена: {slug}.shops.botmanagertest.online",
    example: "my-shop",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/, {
    message:
      "Slug может содержать только латинские буквы (a-z), цифры и дефисы",
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "URL логотипа магазина",
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Заголовок магазина",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: "Описание магазина",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: "Кастомные CSS стили",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  customStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок",
  })
  @IsOptional()
  @IsArray()
  buttonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки кнопок",
  })
  @IsOptional()
  @IsObject()
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Конфигурация макета",
  })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Браузерный доступ включен",
  })
  @IsOptional()
  @IsBoolean()
  browserAccessEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Требовать верификацию email",
  })
  @IsOptional()
  @IsBoolean()
  browserAccessRequireEmailVerification?: boolean;
}

/**
 * Фильтры для списка магазинов
 */
export class ShopFiltersDto {
  @ApiPropertyOptional({
    description: "Поиск по названию",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Только с привязанным ботом",
  })
  @IsOptional()
  @IsBoolean()
  hasBot?: boolean;
}

