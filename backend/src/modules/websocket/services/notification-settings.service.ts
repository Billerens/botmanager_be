import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../../database/entities/user.entity";
import { NotificationType } from "../interfaces/notification.interface";
import {
  NotificationTypeInfo,
  NotificationSettingsResponseDto,
} from "../dto/notification-settings.dto";

/**
 * Сервис для управления настройками уведомлений пользователей
 */
@Injectable()
export class NotificationSettingsService {
  private readonly logger = new Logger(NotificationSettingsService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Получает список всех доступных типов уведомлений
   * category и description локализуются на фронтенде
   */
  getAvailableNotificationTypes(): NotificationTypeInfo[] {
    return [
      // Боты
      {
        type: NotificationType.BOT_CREATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOT_UPDATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOT_DELETED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOT_STATUS_CHANGED,
        defaultEnabled: true,
      },
      // Сообщения
      {
        type: NotificationType.MESSAGE_RECEIVED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.MESSAGE_SENT,
        defaultEnabled: false,
      },
      {
        type: NotificationType.BROADCAST_STARTED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BROADCAST_COMPLETED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BROADCAST_FAILED,
        defaultEnabled: true,
      },
      // Лиды
      {
        type: NotificationType.LEAD_CREATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.LEAD_UPDATED,
        defaultEnabled: false,
      },
      {
        type: NotificationType.LEAD_STATUS_CHANGED,
        defaultEnabled: true,
      },
      // Бронирования
      {
        type: NotificationType.BOOKING_CREATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOOKING_UPDATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOOKING_CANCELLED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.BOOKING_REMINDER,
        defaultEnabled: true,
      },
      // Продукты
      {
        type: NotificationType.PRODUCT_CREATED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.PRODUCT_UPDATED,
        defaultEnabled: false,
      },
      {
        type: NotificationType.PRODUCT_DELETED,
        defaultEnabled: true,
      },
      {
        type: NotificationType.PRODUCT_STOCK_LOW,
        defaultEnabled: true,
      },
      // Аналитика
      {
        type: NotificationType.STATS_UPDATED,
        defaultEnabled: false,
      },
      // Пользователи
      {
        type: NotificationType.USER_UPDATED,
        defaultEnabled: false,
      },
      // Системные
      {
        type: NotificationType.SYSTEM_NOTIFICATION,
        defaultEnabled: true,
      },
      {
        type: NotificationType.ERROR,
        defaultEnabled: true,
      },
    ];
  }

  /**
   * Получает настройки уведомлений пользователя
   */
  async getUserNotificationSettings(
    userId: string,
  ): Promise<NotificationSettingsResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    const availableTypes = this.getAvailableNotificationTypes();
    const defaultSettings = this.getDefaultSettings(availableTypes);
    const userSettings = user.notificationSettings || {};

    // Объединяем настройки пользователя с настройками по умолчанию
    const mergedSettings = availableTypes.reduce(
      (acc, typeInfo) => {
        acc[typeInfo.type] =
          userSettings[typeInfo.type] !== undefined
            ? userSettings[typeInfo.type]
            : typeInfo.defaultEnabled;
        return acc;
      },
      {} as Record<NotificationType, boolean>,
    );

    return {
      settings: mergedSettings,
      availableTypes,
    };
  }

  /**
   * Обновляет настройки уведомлений пользователя
   */
  async updateUserNotificationSettings(
    userId: string,
    settings: Partial<Record<NotificationType, boolean>>,
  ): Promise<NotificationSettingsResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    // Объединяем новые настройки с существующими
    const currentSettings = user.notificationSettings || {};
    const updatedSettings = {
      ...currentSettings,
      ...settings,
    };

    // Сохраняем настройки
    user.notificationSettings = updatedSettings;
    await this.userRepository.save(user);

    this.logger.log(`Настройки уведомлений обновлены для пользователя ${userId}`);

    return this.getUserNotificationSettings(userId);
  }

  /**
   * Проверяет, включено ли уведомление для пользователя
   */
  async isNotificationEnabled(
    userId: string,
    notificationType: NotificationType,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    const availableTypes = this.getAvailableNotificationTypes();
    const typeInfo = availableTypes.find((t) => t.type === notificationType);

    if (!typeInfo) {
      return false;
    }

    const userSettings = user.notificationSettings || {};
    return (
      userSettings[notificationType] !== undefined
        ? userSettings[notificationType]
        : typeInfo.defaultEnabled
    );
  }

  /**
   * Получает настройки по умолчанию
   */
  private getDefaultSettings(
    availableTypes: NotificationTypeInfo[],
  ): Record<NotificationType, boolean> {
    return availableTypes.reduce(
      (acc, typeInfo) => {
        acc[typeInfo.type] = typeInfo.defaultEnabled;
        return acc;
      },
      {} as Record<NotificationType, boolean>,
    );
  }
}

