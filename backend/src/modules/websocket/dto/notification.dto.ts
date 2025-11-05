import { NotificationType } from "../interfaces/notification.interface";
import { IsOptional, IsNumber, IsBoolean, Min, IsArray } from "class-validator";
import { Type, Transform } from "class-transformer";

/**
 * DTO для уведомления в списке
 */
export class NotificationItemDto {
  id: string;
  type: NotificationType;
  payload: any;
  timestamp: number;
  read: boolean;
  createdAt: Date;
}

/**
 * DTO для списка уведомлений
 */
export class NotificationListDto {
  notifications: NotificationItemDto[];
  total: number;
  unreadCount: number;
}

/**
 * DTO для сводки уведомлений (по типам)
 */
export class NotificationSummaryDto {
  type: NotificationType;
  count: number;
  latestTimestamp: number;
}

/**
 * DTO для запроса списка уведомлений
 */
export class GetNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === "true" || value === "1") return true;
    if (value === false || value === "false" || value === "0") return false;
    return undefined; // Если значение не передано, оставляем undefined
  })
  @IsBoolean()
  unreadOnly?: boolean = false;
}

/**
 * DTO для пометки уведомлений как прочитанных
 */
export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  notificationIds?: string[]; // Если не указано, помечаются все

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  all?: boolean = false;
}
