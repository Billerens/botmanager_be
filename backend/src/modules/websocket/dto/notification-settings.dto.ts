import { IsObject, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { NotificationType } from "../interfaces/notification.interface";

/**
 * DTO для настроек уведомлений пользователя
 */
export class NotificationSettingsDto {
  @ApiProperty({
    description: "Настройки для каждого типа уведомления",
    example: {
      "bot.created": true,
      "bot.updated": false,
      "message.received": true,
    },
  })
  @IsObject()
  settings: Record<NotificationType, boolean>;
}

/**
 * DTO для обновления настроек уведомлений
 */
export class UpdateNotificationSettingsDto {
  @ApiProperty({
    description: "Настройки для каждого типа уведомления",
    example: {
      "bot.created": true,
      "bot.updated": false,
    },
  })
  @IsObject()
  settings: Partial<Record<NotificationType, boolean>>;
}

/**
 * DTO для ответа с настройками уведомлений
 */
export class NotificationSettingsResponseDto {
  @ApiProperty({
    description: "Настройки для каждого типа уведомления",
  })
  settings: Record<NotificationType, boolean>;

  @ApiProperty({
    description: "Список всех доступных типов уведомлений",
  })
  availableTypes: NotificationTypeInfo[];
}

/**
 * Информация о типе уведомления
 * category и description локализуются на фронтенде
 */
export class NotificationTypeInfo {
  @ApiProperty({ description: "Тип уведомления" })
  type: NotificationType;

  @ApiProperty({ description: "Включено ли уведомление по умолчанию" })
  defaultEnabled: boolean;
}

