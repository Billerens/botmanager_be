import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CustomPageStatus } from "../entities/custom-page.entity";

export class CreateCustomPageDto {
  @ApiProperty({
    description: "Название страницы",
    example: "Контакты",
  })
  @IsString()
  @MinLength(1, { message: "Название страницы обязательно" })
  @MaxLength(100, { message: "Название страницы не должно превышать 100 символов" })
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

  @ApiProperty({
    description: "HTML/Markdown контент страницы",
    example: "<h1>Контакты</h1><p>Телефон: +7 (999) 123-45-67</p>",
  })
  @IsString()
  @MinLength(1, { message: "Контент страницы обязателен" })
  content: string;

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
}

export class UpdateCustomPageDto {
  @ApiPropertyOptional({
    description: "Название страницы",
    example: "Обновленные контакты",
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Название страницы не может быть пустым" })
  @MaxLength(100, { message: "Название страницы не должно превышать 100 символов" })
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
    description: "HTML/Markdown контент страницы",
    example: "<h1>Обновленные контакты</h1><p>Новый телефон: +7 (999) 987-65-43</p>",
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Контент страницы не может быть пустым" })
  content?: string;

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
}
