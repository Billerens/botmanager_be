import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * DTO ответа для системы бронирования
 */
export class BookingSystemResponseDto {
  @ApiProperty({ description: "ID системы бронирования" })
  id: string;

  @ApiProperty({ description: "Название системы" })
  name: string;

  @ApiPropertyOptional({ description: "Slug для субдомена" })
  slug?: string;

  @ApiPropertyOptional({ description: "Статус субдомена" })
  subdomainStatus?: string;

  @ApiPropertyOptional({ description: "Ошибка субдомена" })
  subdomainError?: string;

  @ApiPropertyOptional({ description: "Дата активации субдомена" })
  subdomainActivatedAt?: Date;

  @ApiPropertyOptional({ description: "URL субдомена" })
  subdomainUrl?: string;

  @ApiProperty({ description: "ID владельца" })
  ownerId: string;

  @ApiPropertyOptional({ description: "ID привязанного бота" })
  botId?: string;

  @ApiPropertyOptional({ description: "URL логотипа" })
  logoUrl?: string;

  @ApiPropertyOptional({ description: "Заголовок" })
  title?: string;

  @ApiPropertyOptional({ description: "Описание" })
  description?: string;

  @ApiPropertyOptional({ description: "Кастомные CSS стили" })
  customStyles?: string;

  @ApiPropertyOptional({ description: "Типы кнопок" })
  buttonTypes?: string[];

  @ApiPropertyOptional({ description: "Настройки кнопок" })
  buttonSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: "Настройки системы бронирования" })
  settings?: Record<string, any>;

  @ApiProperty({ description: "Браузерный доступ включен" })
  browserAccessEnabled: boolean;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "URL системы бронирования" })
  url?: string;

  @ApiPropertyOptional({ description: "Публичный URL" })
  publicUrl?: string;

  @ApiPropertyOptional({ description: "Отображаемое имя" })
  displayName?: string;

  @ApiPropertyOptional({ description: "Есть привязанный бот" })
  hasBot?: boolean;

  @ApiPropertyOptional({ description: "Активен ли субдомен" })
  hasActiveSubdomain?: boolean;
}

/**
 * DTO для статистики системы бронирования
 */
export class BookingSystemStatsDto {
  @ApiProperty({ description: "Количество специалистов" })
  specialistsCount: number;

  @ApiProperty({ description: "Количество услуг" })
  servicesCount: number;

  @ApiProperty({ description: "Количество бронирований" })
  bookingsCount: number;

  @ApiProperty({ description: "Количество подтвержденных бронирований" })
  confirmedBookingsCount: number;

  @ApiProperty({ description: "Количество завершенных бронирований" })
  completedBookingsCount: number;

  @ApiProperty({ description: "Количество отмененных бронирований" })
  cancelledBookingsCount: number;

  @ApiProperty({ description: "Процент подтверждений" })
  confirmationRate: number;

  @ApiProperty({ description: "Процент завершений" })
  completionRate: number;

  @ApiProperty({ description: "Процент отмен" })
  cancellationRate: number;
}

/**
 * DTO для публичных данных системы бронирования
 */
export class PublicBookingSystemResponseDto {
  @ApiProperty({ description: "ID системы бронирования" })
  id: string;

  @ApiPropertyOptional({ description: "Заголовок" })
  title?: string;

  @ApiPropertyOptional({ description: "Описание" })
  description?: string;

  @ApiPropertyOptional({ description: "URL логотипа" })
  logoUrl?: string;

  @ApiPropertyOptional({ description: "Кастомные CSS стили" })
  customStyles?: string;

  @ApiPropertyOptional({ description: "Настройки системы бронирования" })
  settings?: Record<string, any>;

  @ApiProperty({ description: "Браузерный доступ включен" })
  browserAccessEnabled: boolean;
}

/**
 * DTO ошибки
 */
export class ErrorResponseDto {
  @ApiProperty({ description: "Код ошибки" })
  statusCode: number;

  @ApiProperty({ description: "Сообщение об ошибке" })
  message: string;

  @ApiPropertyOptional({ description: "Тип ошибки" })
  error?: string;
}

/**
 * DTO для успешного удаления
 */
export class DeleteResponseDto {
  @ApiProperty({ description: "Сообщение об успешном удалении" })
  message: string;
}
