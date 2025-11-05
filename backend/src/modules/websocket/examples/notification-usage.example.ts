/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ NotificationService
 * 
 * Этот файл содержит примеры того, как отправлять уведомления из различных модулей системы.
 * NotificationService доступен глобально, так как WebSocketModule является @Global()
 */

import { Injectable } from "@nestjs/common";
import { NotificationService } from "../services/notification.service";
import { NotificationType } from "../interfaces/notification.interface";

/**
 * Пример 1: Отправка уведомления при создании бота
 */
@Injectable()
export class BotServiceExample {
  constructor(private notificationService: NotificationService) {}

  async createBot(userId: string, botData: any) {
    // ... логика создания бота ...

    // Отправляем уведомление владельцу бота
    await this.notificationService.sendToUser(
      userId,
      NotificationType.BOT_CREATED,
      {
        botId: botData.id,
        botName: botData.name,
        message: "Бот успешно создан",
      },
    );
  }
}

/**
 * Пример 2: Отправка уведомления в комнату (например, для всех пользователей бота)
 */
@Injectable()
export class MessageServiceExample {
  constructor(private notificationService: NotificationService) {}

  async sendMessage(botId: string, messageData: any) {
    // ... логика отправки сообщения ...

    // Отправляем уведомление всем пользователям, подписанным на комнату бота
    await this.notificationService.sendToRoom(
      `bot-${botId}`,
      NotificationType.MESSAGE_RECEIVED,
      {
        botId,
        message: messageData,
        timestamp: new Date().toISOString(),
      },
    );
  }
}

/**
 * Пример 3: Broadcast уведомление всем подключенным пользователям
 */
@Injectable()
export class SystemServiceExample {
  constructor(private notificationService: NotificationService) {}

  async sendSystemMaintenanceNotification() {
    await this.notificationService.broadcast(
      NotificationType.SYSTEM_NOTIFICATION,
      {
        message: "Плановое техническое обслуживание начнется через 10 минут",
        level: "warning",
        timestamp: new Date().toISOString(),
      },
    );
  }
}

/**
 * Пример 4: Отправка уведомления о бронировании
 */
@Injectable()
export class BookingServiceExample {
  constructor(private notificationService: NotificationService) {}

  async createBooking(userId: string, bookingData: any) {
    // ... логика создания бронирования ...

    // Уведомляем пользователя о создании бронирования
    await this.notificationService.sendToUser(
      userId,
      NotificationType.BOOKING_CREATED,
      {
        bookingId: bookingData.id,
        specialistName: bookingData.specialistName,
        serviceName: bookingData.serviceName,
        dateTime: bookingData.dateTime,
        message: "Ваше бронирование подтверждено",
      },
    );
  }

  async sendBookingReminder(userId: string, bookingData: any) {
    await this.notificationService.sendToUser(
      userId,
      NotificationType.BOOKING_REMINDER,
      {
        bookingId: bookingData.id,
        message: `Напоминание: у вас бронирование ${bookingData.dateTime}`,
        bookingData,
      },
    );
  }
}

/**
 * Пример 5: Отправка уведомления об ошибке
 */
@Injectable()
export class ErrorHandlingExample {
  constructor(private notificationService: NotificationService) {}

  async handleError(userId: string, error: Error) {
    // Логируем ошибку
    console.error("Error:", error);

    // Отправляем уведомление пользователю (если userId указан)
    if (userId) {
      await this.notificationService.sendError(error, userId);
    }
  }
}

/**
 * Пример 6: Отправка уведомления о низком количестве товара
 */
@Injectable()
export class ProductServiceExample {
  constructor(private notificationService: NotificationService) {}

  async checkProductStock(productId: string, userId: string) {
    // ... проверка количества товара ...

    const currentStock = 5; // пример
    if (currentStock < 10) {
      // Уведомляем владельца магазина о низком количестве товара
      await this.notificationService.sendToUser(
        userId,
        NotificationType.PRODUCT_STOCK_LOW,
        {
          productId,
          currentStock,
          message: `Внимание! Осталось всего ${currentStock} единиц товара`,
        },
      );
    }
  }
}

/**
 * Пример 7: Использование общего метода sendNotification для гибкости
 */
@Injectable()
export class FlexibleNotificationExample {
  constructor(private notificationService: NotificationService) {}

  async sendCustomNotification(data: {
    type: NotificationType;
    payload: any;
    userId?: string;
    room?: string;
    broadcast?: boolean;
  }) {
    await this.notificationService.sendNotification({
      type: data.type,
      payload: data.payload,
      userId: data.userId,
      room: data.room,
      broadcast: data.broadcast,
    });
  }
}

