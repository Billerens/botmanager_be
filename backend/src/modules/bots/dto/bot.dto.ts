import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsBoolean,
  IsArray,
  IsObject,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ButtonSettingsDto } from "./command-button-settings.dto";

export class CreateBotDto {
  @ApiProperty({ description: "Название бота", example: "Мой Telegram бот" })
  @IsString()
  @MinLength(1, { message: "Название бота обязательно" })
  @MaxLength(100, { message: "Название бота не должно превышать 100 символов" })
  name: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Бот для обработки заявок",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание бота не должно превышать 500 символов" })
  description?: string;

  @ApiProperty({
    description: "Токен бота от @BotFather",
    example: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  })
  @IsString()
  @MinLength(1, { message: "Токен бота обязателен" })
  token: string;
}

export class UpdateBotDto {
  @ApiProperty({
    description: "Название бота",
    example: "Обновленное название бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Название бота не может быть пустым" })
  @MaxLength(100, { message: "Название бота не должно превышать 100 символов" })
  name?: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Обновленное описание бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание бота не должно превышать 500 символов" })
  description?: string;

  // Поля для магазина
  @ApiPropertyOptional({
    description: "Включить магазин для бота",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isShop?: boolean;

  @ApiPropertyOptional({
    description: "URL логотипа магазина",
    example: "https://example.com/logo.png",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "URL логотипа не должен превышать 500 символов" })
  shopLogoUrl?: string;

  @ApiPropertyOptional({
    description: "Заголовок магазина",
    example: "Мой магазин",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: "Заголовок магазина не должен превышать 100 символов",
  })
  shopTitle?: string;

  @ApiPropertyOptional({
    description: "Описание магазина",
    example: "Добро пожаловать в наш магазин!",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: "Описание магазина не должно превышать 500 символов",
  })
  shopDescription?: string;

  @ApiPropertyOptional({
    description: "Кастомные CSS стили для магазина",
    example:
      ".shop-header { background: linear-gradient(45deg, #ff6b6b, #4ecdc4); }",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "CSS стили не должны превышать 2000 символов" })
  shopCustomStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок магазина",
    example: [
      "menu_button",
      "main_app",
      "command",
      "inline_button",
      "keyboard_button",
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shopButtonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки для разных типов кнопок",
    type: ButtonSettingsDto,
  })
  @IsOptional()
  @IsObject()
  shopButtonSettings?: ButtonSettingsDto;

  // Поля для системы бронирования
  @ApiPropertyOptional({
    description: "Включить систему бронирования для бота",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isBookingEnabled?: boolean;

  @ApiPropertyOptional({
    description: "URL логотипа для системы бронирования",
    example: "https://example.com/booking-logo.png",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "URL логотипа не должен превышать 500 символов" })
  bookingLogoUrl?: string;

  @ApiPropertyOptional({
    description: "Заголовок для системы бронирования",
    example: "Записаться на прием",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: "Заголовок бронирования не должен превышать 100 символов",
  })
  bookingTitle?: string;

  @ApiPropertyOptional({
    description: "Описание для системы бронирования",
    example: "Выберите удобное время для записи к специалисту",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: "Описание бронирования не должно превышать 500 символов",
  })
  bookingDescription?: string;

  @ApiPropertyOptional({
    description: "Кастомные CSS стили для системы бронирования",
    example:
      ".booking-header { background: linear-gradient(45deg, #4ecdc4, #44a08d); }",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "CSS стили не должны превышать 2000 символов" })
  bookingCustomStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок для системы бронирования",
    example: ["menu_button", "command"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bookingButtonTypes?: string[];

  @ApiPropertyOptional({
    description: "Настройки для разных типов кнопок бронирования",
    type: ButtonSettingsDto,
  })
  @IsOptional()
  @IsObject()
  bookingButtonSettings?: ButtonSettingsDto;

  // Настройки браузерного доступа
  @ApiPropertyOptional({
    description: "Разрешить доступ к магазину из обычного браузера",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  shopBrowserAccessEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Разрешить доступ к бронированию из обычного браузера",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  bookingBrowserAccessEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Требовать подтверждение email для браузерного доступа",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  browserAccessRequireEmailVerification?: boolean;
}
