/**
 * Типы уведомлений для WebSocket
 */
export enum NotificationType {
  // Боты
  BOT_CREATED = "bot.created",
  BOT_UPDATED = "bot.updated",
  BOT_DELETED = "bot.deleted",
  BOT_STATUS_CHANGED = "bot.status_changed",

  // Сообщения
  MESSAGE_RECEIVED = "message.received",
  MESSAGE_SENT = "message.sent",
  BROADCAST_STARTED = "broadcast.started",
  BROADCAST_COMPLETED = "broadcast.completed",
  BROADCAST_FAILED = "broadcast.failed",

  // Лиды
  LEAD_CREATED = "lead.created",
  LEAD_UPDATED = "lead.updated",
  LEAD_STATUS_CHANGED = "lead.status_changed",

  // Бронирования
  BOOKING_CREATED = "booking.created",
  BOOKING_UPDATED = "booking.updated",
  BOOKING_CANCELLED = "booking.cancelled",
  BOOKING_REMINDER = "booking.reminder",

  // Продукты
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  PRODUCT_DELETED = "product.deleted",
  PRODUCT_STOCK_LOW = "product.stock_low",

  // Корзины
  CART_CREATED = "cart.created",
  CART_UPDATED = "cart.updated",
  CART_ITEM_ADDED = "cart.item_added",
  CART_ITEM_REMOVED = "cart.item_removed",
  CART_CLEARED = "cart.cleared",

  // Заказы
  ORDER_CREATED = "order.created",
  ORDER_STATUS_UPDATED = "order.status_updated",
  ORDER_STATUS_CHANGED = "order.status_changed",
  ORDER_CANCELLED = "order.cancelled",
  ORDER_UPDATED = "order.updated",

  // Промокоды
  SHOP_PROMOCODE_CREATED = "shop_promocode.created",
  SHOP_PROMOCODE_UPDATED = "shop_promocode.updated",
  SHOP_PROMOCODE_DELETED = "shop_promocode.deleted",
  SHOP_PROMOCODE_USED = "shop_promocode.used",
  SHOP_PROMOCODE_UNLINKED = "shop_promocode.unlinked",

  // Категории
  CATEGORY_CREATED = "category.created",
  CATEGORY_UPDATED = "category.updated",
  CATEGORY_DELETED = "category.deleted",

  // Аналитика
  STATS_UPDATED = "stats.updated",
  PRODUCT_STATS_UPDATED = "product_stats.updated",

  // Пользователи
  USER_UPDATED = "user.updated",

  // Custom Pages
  CUSTOM_PAGE_CREATED = "custom_page.created",
  CUSTOM_PAGE_UPDATED = "custom_page.updated",
  CUSTOM_PAGE_DELETED = "custom_page.deleted",

  // Системные
  SYSTEM_NOTIFICATION = "system.notification",
  ERROR = "error",
}

/**
 * Интерфейс уведомления
 */
export interface Notification {
  id: string;
  type: NotificationType;
  payload: any;
  timestamp: number;
  userId?: string; // Если указан, отправляется только этому пользователю
  room?: string; // Если указана, отправляется в комнату
  broadcast?: boolean; // Если true, отправляется всем подключенным пользователям
  read?: boolean; // Прочитано ли уведомление
}

/**
 * Интерфейс для отправки уведомления
 */
export interface SendNotificationDto {
  type: NotificationType;
  payload: any;
  userId?: string;
  room?: string;
  broadcast?: boolean;
}
