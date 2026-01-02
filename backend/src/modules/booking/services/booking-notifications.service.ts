import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import {
  Booking,
  BookingReminder,
} from "../../../database/entities/booking.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { QueueService } from "../../queue/queue.service";
import { NotificationService } from "../../websocket/services/notification.service";
import { NotificationType } from "../../websocket/interfaces/notification.interface";

@Injectable()
export class BookingNotificationsService {
  private readonly logger = new Logger(BookingNotificationsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    private readonly telegramService: TelegramService,
    private readonly queueService: QueueService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Планирует уведомления для бронирования
   */
  async scheduleReminders(booking: Booking): Promise<void> {
    if (!booking.reminders || booking.reminders.length === 0) {
      this.logger.log(`No reminders to schedule for booking ${booking.id}`);
      return;
    }

    if (!booking.telegramUserId) {
      this.logger.warn(
        `Cannot schedule reminders for booking ${booking.id}: no telegramUserId`
      );
      return;
    }

    // Загружаем полную информацию о бронировании
    const fullBooking = await this.bookingRepository.findOne({
      where: { id: booking.id },
      relations: ["specialist", "service", "timeSlot"],
    });

    if (!fullBooking) {
      this.logger.error(`Booking ${booking.id} not found`);
      return;
    }

    // Получаем timezone пользователя из clientData
    const clientTimezone = fullBooking.clientData?.clientTimezone as
      | string
      | undefined;

    // Интерпретируем время слота как "время на часах" в локальном часовом поясе пользователя
    // Если timezone есть, конвертируем UTC время в локальное для расчета напоминаний
    let bookingTimeLocal: Date;
    if (clientTimezone) {
      // Время слота в БД хранится как UTC (например, 12:00 UTC)
      // Но оно должно интерпретироваться как "12:00" по локальному времени пользователя
      // Конвертируем: если пользователь видел "12:00" и он в UTC+3,
      // то реальное UTC время = 12:00 - 3 часа = 09:00 UTC
      bookingTimeLocal = this.convertUTCTimeToLocal(
        new Date(fullBooking.timeSlot.startTime),
        clientTimezone
      );
      this.logger.log(
        `Using client timezone ${clientTimezone} for booking ${booking.id}`
      );
    } else {
      // Fallback: если timezone не указан, используем UTC время как есть
      bookingTimeLocal = new Date(fullBooking.timeSlot.startTime);
      this.logger.warn(
        `No timezone found for booking ${booking.id}, using UTC time`
      );
    }

    const now = new Date();

    this.logger.log(
      `Scheduling reminders for booking ${booking.id}:
       Booking time (UTC in DB): ${fullBooking.timeSlot.startTime.toISOString()}
       Booking time (local interpretation): ${bookingTimeLocal.toISOString()}
       Current time: ${now.toISOString()}
       Time until booking: ${Math.floor((bookingTimeLocal.getTime() - now.getTime()) / 1000 / 60)} minutes`
    );

    // Планируем каждое напоминание
    for (let i = 0; i < fullBooking.reminders.length; i++) {
      const reminder = fullBooking.reminders[i];

      if (reminder.sent) {
        continue; // Уже отправлено
      }

      // Рассчитываем время напоминания относительно локального времени бронирования
      const scheduledTime = this.calculateReminderTime(
        bookingTimeLocal,
        reminder.timeValue,
        reminder.timeUnit
      );

      // Обновляем запланированное время
      fullBooking.reminders[i].scheduledFor = scheduledTime;

      const delayInMs = scheduledTime.getTime() - now.getTime();

      this.logger.log(
        `Reminder ${i}: ${reminder.timeValue} ${reminder.timeUnit} before booking
         Scheduled for: ${scheduledTime.toISOString()}
         Delay: ${Math.floor(delayInMs / 1000 / 60)} minutes (${delayInMs}ms)`
      );

      if (delayInMs <= 0) {
        // Время уже прошло - отправляем сразу
        this.logger.log(
          `Reminder time has passed (${Math.abs(Math.floor(delayInMs / 1000 / 60))} minutes ago), sending immediately for booking ${booking.id}`
        );
        await this.sendReminder(fullBooking, i);
      } else {
        // Добавляем в очередь с задержкой
        this.logger.log(
          `Scheduling reminder for booking ${booking.id} in ${Math.floor(delayInMs / 1000 / 60)} minutes`
        );
        await this.queueService.addBookingReminderJob(
          {
            bookingId: booking.id,
            reminderIndex: i,
          },
          delayInMs
        );
      }
    }

    // Сохраняем обновленные reminders с scheduledFor
    await this.bookingRepository.save(fullBooking);
  }

  /**
   * Конвертирует UTC время из БД в локальное время пользователя
   * Интерпретирует UTC время как "время на часах" в указанном часовом поясе
   *
   * @param utcTime Время в UTC из БД (например, 12:00 UTC)
   * @param timezoneOffset Timezone offset в формате "+HH:mm" или "-HH:mm" (например, "+03:00")
   * @returns Реальное UTC время, соответствующее "времени на часах" в локальном часовом поясе
   *
   * Пример:
   * - В БД: 2025-05-25T12:00:00Z (12:00 UTC)
   * - Timezone: "+03:00"
   * - Интерпретация: "12:00" по времени пользователя (UTC+3)
   * - Результат: 2025-05-25T09:00:00Z (12:00 - 3 часа = 09:00 UTC)
   */
  private convertUTCTimeToLocal(utcTime: Date, timezoneOffset: string): Date {
    // Парсим timezone offset (формат: "+03:00", "-05:00" или "Z")
    let offsetMs = 0;

    if (timezoneOffset === "Z" || timezoneOffset === "+00:00") {
      offsetMs = 0;
    } else {
      const match = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (!match) {
        this.logger.warn(
          `Invalid timezone offset format: ${timezoneOffset}, using UTC`
        );
        return utcTime;
      }

      const sign = match[1] === "+" ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);

      offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
    }

    // Вычитаем offset из UTC времени, чтобы получить реальное UTC время
    // Если пользователь видел "12:00" в UTC+3, то реальное UTC время = 12:00 - 3 часа
    return new Date(utcTime.getTime() - offsetMs);
  }

  /**
   * Вычисляет время отправки напоминания
   */
  private calculateReminderTime(
    bookingTime: Date,
    timeValue: number,
    timeUnit: "minutes" | "hours" | "days"
  ): Date {
    const milliseconds = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    const offset = timeValue * milliseconds[timeUnit];
    return new Date(bookingTime.getTime() - offset);
  }

  /**
   * Отправляет напоминание
   */
  async sendReminder(booking: Booking, reminderIndex: number): Promise<void> {
    try {
      // Загружаем полную информацию если не загружена
      let fullBooking = booking;
      if (
        !booking.specialist ||
        !booking.service ||
        !booking.timeSlot ||
        !booking.specialist.bookingSystem?.bot
      ) {
        const loaded = await this.bookingRepository.findOne({
          where: { id: booking.id },
          relations: [
            "specialist",
            "specialist.bookingSystem",
            "specialist.bookingSystem.bot",
            "service",
            "timeSlot",
          ],
        });

        if (!loaded) {
          this.logger.error(`Booking ${booking.id} not found`);
          return;
        }

        fullBooking = loaded;
      }

      if (!fullBooking.telegramUserId) {
        this.logger.warn(
          `Cannot send reminder for booking ${booking.id}: no telegramUserId`
        );
        return;
      }

      // Получаем бота через bookingSystem
      const bot = fullBooking.specialist.bookingSystem?.bot;

      if (!bot) {
        this.logger.error(`Bot not found for booking ${booking.id}`);
        return;
      }

      // Формируем сообщение
      const message = this.formatReminderMessage(fullBooking);

      // Расшифровываем токен бота
      const decryptedToken = this.decryptToken(bot.token);

      // Отправляем через Telegram
      await this.telegramService.sendMessage(
        decryptedToken,
        fullBooking.telegramUserId,
        message,
        { parse_mode: "HTML" }
      );

      // Обновляем статус напоминания
      fullBooking.reminders[reminderIndex].sent = true;
      fullBooking.reminders[reminderIndex].sentAt = new Date();
      await this.bookingRepository.save(fullBooking);

      this.logger.log(
        `Reminder sent successfully for booking ${booking.id}, reminder index ${reminderIndex}`
      );

      // Отправляем уведомление владельцу бота о напоминании
      if (bot && bot.ownerId) {
        this.notificationService
          .sendToUser(bot.ownerId, NotificationType.BOOKING_REMINDER, {
            botId: bot.id,
            botName: bot.name,
            booking: {
              id: fullBooking.id,
              clientName: fullBooking.clientName,
              clientPhone: fullBooking.clientPhone,
            },
            specialist: fullBooking.specialist
              ? { name: fullBooking.specialist.name }
              : undefined,
            service: fullBooking.service
              ? { name: fullBooking.service.name }
              : undefined,
            timeSlot: fullBooking.timeSlot
              ? { startTime: fullBooking.timeSlot.startTime }
              : undefined,
            reminderIndex,
          })
          .catch((error) => {
            this.logger.error(
              "Ошибка отправки уведомления о напоминании:",
              error
            );
          });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send reminder for booking ${booking.id}:`,
        error
      );
    }
  }

  /**
   * Форматирует сообщение напоминания
   */
  private formatReminderMessage(booking: Booking): string {
    const bookingDate = new Date(booking.timeSlot.startTime).toLocaleDateString(
      "ru-RU",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );

    const bookingTime = new Date(booking.timeSlot.startTime).toLocaleTimeString(
      "ru-RU",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    const duration = Math.floor(
      (new Date(booking.timeSlot.endTime).getTime() -
        new Date(booking.timeSlot.startTime).getTime()) /
        (1000 * 60)
    );

    let message = `🔔 <b>Напоминание о записи</b>\n\n`;
    message += `👤 <b>Клиент:</b> ${booking.clientName}\n`;
    message += `💼 <b>Услуга:</b> ${booking.service.name}\n`;
    message += `👨‍💼 <b>Специалист:</b> ${booking.specialist.name}\n`;
    message += `📅 <b>Дата:</b> ${bookingDate}\n`;
    message += `🕐 <b>Время:</b> ${bookingTime}\n`;
    message += `⏱ <b>Длительность:</b> ${duration} мин\n`;

    if (booking.service.price) {
      message += `💰 <b>Стоимость:</b> ${booking.service.price} ₽\n`;
    }

    if (booking.notes) {
      message += `\n📝 <b>Примечания:</b> ${booking.notes}\n`;
    }

    message += `\n<i>Ждем вас! Если вам нужно отменить или перенести запись, пожалуйста, свяжитесь с нами заранее.</i>`;

    return message;
  }

  /**
   * Отменяет все запланированные напоминания для бронирования
   */
  async cancelReminders(bookingId: string): Promise<void> {
    this.logger.log(`Cancelling reminders for booking ${bookingId}`);

    try {
      // Отменяем задачи в очереди BullMQ
      const cancelledCount =
        await this.queueService.cancelBookingReminders(bookingId);
      this.logger.log(
        `Cancelled ${cancelledCount} reminder jobs from queue for booking ${bookingId}`
      );

      // Помечаем все неотправленные напоминания как отправленные, чтобы они не отправлялись через backup механизм
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
      });

      if (booking && booking.reminders) {
        let updated = false;
        for (let i = 0; i < booking.reminders.length; i++) {
          if (!booking.reminders[i].sent) {
            booking.reminders[i].sent = true;
            updated = true;
          }
        }

        if (updated) {
          await this.bookingRepository.save(booking);
          this.logger.log(
            `Marked all reminders as sent for cancelled booking ${bookingId}`
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel reminders for booking ${bookingId}:`,
        error
      );
      // Не пробрасываем ошибку, чтобы не блокировать отмену бронирования
    }
  }

  /**
   * Получает статистику по уведомлениям для BookingSystem
   */
  async getReminderStats(bookingSystemId: string): Promise<any> {
    const bookings = await this.bookingRepository
      .createQueryBuilder("booking")
      .leftJoin("booking.specialist", "specialist")
      .where("specialist.bookingSystemId = :bookingSystemId", {
        bookingSystemId,
      })
      .andWhere("booking.reminders IS NOT NULL")
      .getMany();

    let totalReminders = 0;
    let sentReminders = 0;
    let pendingReminders = 0;

    bookings.forEach((booking) => {
      if (booking.reminders) {
        totalReminders += booking.reminders.length;
        sentReminders += booking.reminders.filter((r) => r.sent).length;
        pendingReminders += booking.reminders.filter((r) => !r.sent).length;
      }
    });

    return {
      totalReminders,
      sentReminders,
      pendingReminders,
      bookingsWithReminders: bookings.length,
    };
  }

  /**
   * Отправляет уведомление об отмене бронирования
   */
  async sendCancellationNotification(
    bookingId: string,
    reason: string
  ): Promise<void> {
    try {
      // Загружаем полную информацию о бронировании с bookingSystem и bot
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: [
          "specialist",
          "specialist.bookingSystem",
          "specialist.bookingSystem.bot",
          "service",
          "timeSlot",
        ],
      });

      if (!booking) {
        this.logger.error(`Booking ${bookingId} not found`);
        return;
      }

      if (!booking.telegramUserId) {
        this.logger.warn(
          `Cannot send cancellation notification for booking ${bookingId}: no telegramUserId`
        );
        return;
      }

      // Получаем бота через bookingSystem
      const bot = booking.specialist?.bookingSystem?.bot;

      if (!bot) {
        this.logger.error(`Bot not found for booking ${bookingId}`);
        return;
      }

      // Формируем сообщение об отмене
      const message = this.formatCancellationMessage(booking, reason);

      // Расшифровываем токен бота
      const decryptedToken = this.decryptToken(bot.token);

      // Отправляем через Telegram
      await this.telegramService.sendMessage(
        decryptedToken,
        booking.telegramUserId,
        message,
        { parse_mode: "HTML" }
      );

      this.logger.log(
        `Cancellation notification sent successfully for booking ${bookingId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation notification for booking ${bookingId}:`,
        error
      );
    }
  }

  /**
   * Форматирует сообщение об отмене бронирования
   */
  private formatCancellationMessage(booking: Booking, reason: string): string {
    const bookingDate = new Date(booking.timeSlot.startTime).toLocaleDateString(
      "ru-RU",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );

    const bookingTime = new Date(booking.timeSlot.startTime).toLocaleTimeString(
      "ru-RU",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    const duration = Math.floor(
      (new Date(booking.timeSlot.endTime).getTime() -
        new Date(booking.timeSlot.startTime).getTime()) /
        (1000 * 60)
    );

    return `
🚫 <b>Ваша запись отменена</b>

<b>Дата:</b> ${bookingDate}
<b>Время:</b> ${bookingTime} (${duration} мин)

<b>Услуга:</b> ${booking.service.name}
${booking.service.price ? `<b>Стоимость:</b> ${booking.service.price} ₽` : ""}

<b>Специалист:</b> ${booking.specialist.name}

<b>Причина отмены:</b>
${reason}

Приносим извинения за доставленные неудобства. Вы можете забронировать другое время.
    `.trim();
  }

  /**
   * Расшифровка токена бота (копия из BotsService)
   */
  private decryptToken(encryptedToken: string): string {
    const algorithm = "aes-256-cbc";
    const keyString =
      process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here";
    const key = crypto.scryptSync(keyString, "salt", 32);

    const parts = encryptedToken.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
