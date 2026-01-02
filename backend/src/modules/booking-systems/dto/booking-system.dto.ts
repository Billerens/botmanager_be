import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsUUID,
  MaxLength,
  Matches,
} from "class-validator";

/**
 * Настройки системы бронирования
 */
export class BookingSystemSettingsDto {
  @ApiPropertyOptional({ description: "Разрешить онлайн-бронирование" })
  @IsOptional()
  @IsBoolean()
  allowOnlineBooking?: boolean;

  @ApiPropertyOptional({ description: "Требовать подтверждение" })
  @IsOptional()
  @IsBoolean()
  requireConfirmation?: boolean;

  @ApiPropertyOptional({ description: "Разрешить отмену" })
  @IsOptional()
  @IsBoolean()
  allowCancellation?: boolean;

  @ApiPropertyOptional({
    description: "Лимит времени на отмену (в часах)",
    example: 2,
  })
  @IsOptional()
  cancellationTimeLimit?: number;

  @ApiPropertyOptional({ description: "Отправлять напоминания" })
  @IsOptional()
  @IsBoolean()
  sendReminders?: boolean;

  @ApiPropertyOptional({
    description: "Время напоминания (в часах до записи)",
    example: 24,
  })
  @IsOptional()
  reminderTime?: number;

  @ApiPropertyOptional({ description: "Отправлять подтверждения" })
  @IsOptional()
  @IsBoolean()
  sendConfirmations?: boolean;

  @ApiPropertyOptional({
    description: "Максимальное время бронирования вперед (в днях)",
    example: 30,
  })
  @IsOptional()
  maxAdvanceBooking?: number;

  @ApiPropertyOptional({
    description: "Минимальное время бронирования вперед (в часах)",
    example: 2,
  })
  @IsOptional()
  minAdvanceBooking?: number;

  @ApiPropertyOptional({
    description: "Обязательные поля формы",
    example: ["clientName", "clientPhone"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @ApiPropertyOptional({
    description: "Опциональные поля формы",
    example: ["clientEmail", "notes"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalFields?: string[];

  @ApiPropertyOptional({ description: "Интеграция с календарем" })
  @IsOptional()
  @IsBoolean()
  calendarIntegration?: boolean;

  @ApiPropertyOptional({ description: "Интеграция с платежной системой" })
  @IsOptional()
  @IsBoolean()
  paymentIntegration?: boolean;

  @ApiPropertyOptional({
    description: "Глобальные перерывы для всех специалистов",
  })
  @IsOptional()
  @IsArray()
  globalBreaks?: {
    startTime: string;
    endTime: string;
    reason?: string;
  }[];
}

/**
 * DTO для создания системы бронирования
 */
export class CreateBookingSystemDto {
  @ApiProperty({
    description: "Название системы бронирования",
    example: "Салон красоты",
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Уникальный slug для субдомена",
    example: "my-salon",
  })
  @IsOptional()
  @IsString()
  @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message: "Slug может содержать только строчные буквы, цифры и дефисы",
  })
  slug?: string;

  @ApiPropertyOptional({ description: "URL логотипа" })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Заголовок (отображается пользователям)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: "Описание системы бронирования" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Кастомные CSS стили" })
  @IsOptional()
  @IsString()
  customStyles?: string;

  @ApiPropertyOptional({
    description: "Типы кнопок (command, menu_button)",
    example: ["command"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  buttonTypes?: string[];

  @ApiPropertyOptional({ description: "Настройки кнопок" })
  @IsOptional()
  @IsObject()
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: "Настройки системы бронирования" })
  @IsOptional()
  settings?: BookingSystemSettingsDto;

  @ApiPropertyOptional({ description: "Включить браузерный доступ" })
  @IsOptional()
  @IsBoolean()
  browserAccessEnabled?: boolean;
}

/**
 * DTO для обновления системы бронирования
 */
export class UpdateBookingSystemDto extends PartialType(
  CreateBookingSystemDto
) {}

/**
 * DTO для привязки бота к системе бронирования
 */
export class LinkBotDto {
  @ApiProperty({ description: "ID бота для привязки" })
  @IsUUID()
  botId: string;
}

/**
 * DTO для обновления настроек системы бронирования
 */
export class UpdateBookingSystemSettingsDto extends BookingSystemSettingsDto {}
