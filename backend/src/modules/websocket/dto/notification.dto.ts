import { NotificationType } from "../interfaces/notification.interface";

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
  limit?: number = 50;
  offset?: number = 0;
  unreadOnly?: boolean = false;
}

/**
 * DTO для пометки уведомлений как прочитанных
 */
export class MarkNotificationsReadDto {
  notificationIds?: string[]; // Если не указано, помечаются все
  all?: boolean = false;
}
