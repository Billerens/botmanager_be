import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CustomPageStatus,
  CustomPageType,
} from "../../../database/entities/custom-page.entity";

export class CreateCustomPageDto {
  @ApiProperty({
    description: "Название страницы",
    example: "Контакты",
  })
  @IsString()
  @MinLength(1, { message: "Название страницы обязательно" })
  @MaxLength(100, {
    message: "Название страницы не должно превышать 100 символов",
  })
  title: string;

  @ApiProperty({
    description: "URL-friendly идентификатор страницы (slug)",
    example: "contacts",
  })
  @IsString()
  @MinLength(1, { message: "Slug обязателен" })
  @MaxLength(100, { message: "Slug не должен превышать 100 символов" })
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug может содержать только строчные буквы, цифры и дефисы",
  })
  slug: string;

  @ApiPropertyOptional({
    description: "Описание страницы",
    example: "Свяжитесь с нами",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание не должно превышать 500 символов" })
  description?: string;

  @ApiPropertyOptional({
    description: "Тип страницы: inline (HTML в БД) или static (файлы в S3)",
    example: CustomPageType.INLINE,
    enum: CustomPageType,
    default: CustomPageType.INLINE,
  })
  @IsOptional()
  @IsEnum(CustomPageType)
  pageType?: CustomPageType;

  @ApiPropertyOptional({
    description:
      "HTML/Markdown контент страницы (обязателен для inline режима)",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  @IsOptional()
  @ValidateIf((o) => !o.pageType || o.pageType === CustomPageType.INLINE)
  @IsString({ message: "Контент страницы должен быть строкой" })
  @MinLength(1, { message: "Контент страницы обязателен для inline режима" })
  @MaxLength(5000000, { message: "Контент страницы не должен превышать 5MB" })
  content?: string;

  @ApiPropertyOptional({
    description: "Точка входа для static режима (по умолчанию index.html)",
    example: "index.html",
    default: "index.html",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Путь не должен превышать 255 символов" })
  entryPoint?: string;

  @ApiPropertyOptional({
    description: "Статус страницы",
    example: CustomPageStatus.ACTIVE,
    enum: CustomPageStatus,
  })
  @IsOptional()
  @IsEnum(CustomPageStatus)
  status?: CustomPageStatus;

  @ApiPropertyOptional({
    description: "Открывать только в Telegram WebApp",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isWebAppOnly?: boolean;

  @ApiPropertyOptional({
    description: "Команда в боте для вызова страницы",
    example: "contacts",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Команда не должна превышать 50 символов" })
  botCommand?: string;

  @ApiPropertyOptional({
    description: "Отображать команду в меню бота",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;
}

export class UpdateCustomPageDto {
  @ApiPropertyOptional({
    description: "Название страницы",
    example: "Обновленные контакты",
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Название страницы не может быть пустым" })
  @MaxLength(100, {
    message: "Название страницы не должно превышать 100 символов",
  })
  title?: string;

  @ApiPropertyOptional({
    description: "URL-friendly идентификатор страницы (slug)",
    example: "updated-contacts",
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Slug обязателен" })
  @MaxLength(100, { message: "Slug не должен превышать 100 символов" })
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug может содержать только строчные буквы, цифры и дефисы",
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Описание страницы",
    example: "Обновленное описание",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание не должно превышать 500 символов" })
  description?: string;

  @ApiPropertyOptional({
    description: "Тип страницы: inline (HTML в БД) или static (файлы в S3)",
    example: CustomPageType.INLINE,
    enum: CustomPageType,
  })
  @IsOptional()
  @IsEnum(CustomPageType)
  pageType?: CustomPageType;

  @ApiPropertyOptional({
    description: "HTML/Markdown контент страницы (для inline режима)",
    example:
      "<h1>Обновленные контакты</h1><p>Новый телефон: +7 (999) 987-65-43</p>",
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000000, { message: "Контент страницы не должен превышать 5MB" })
  content?: string;

  @ApiPropertyOptional({
    description: "Точка входа для static режима",
    example: "index.html",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Путь не должен превышать 255 символов" })
  entryPoint?: string;

  @ApiPropertyOptional({
    description: "Статус страницы",
    example: CustomPageStatus.ACTIVE,
    enum: CustomPageStatus,
  })
  @IsOptional()
  @IsEnum(CustomPageStatus)
  status?: CustomPageStatus;

  @ApiPropertyOptional({
    description: "Открывать только в Telegram WebApp",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isWebAppOnly?: boolean;

  @ApiPropertyOptional({
    description: "Команда в боте для вызова страницы",
    example: "new-contacts",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "Команда не должна превышать 50 символов" })
  botCommand?: string;

  @ApiPropertyOptional({
    description: "Отображать команду в меню бота",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showInMenu?: boolean;
}
