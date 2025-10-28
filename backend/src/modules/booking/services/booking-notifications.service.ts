import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import {
  Booking,
  BookingReminder,
} from "../../../database/entities/booking.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { TelegramService } from "../../telegram/telegram.service";
import { QueueService } from "../../queue/queue.service";

@Injectable()
export class BookingNotificationsService {
  private readonly logger = new Logger(BookingNotificationsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    private readonly telegramService: TelegramService,
    private readonly queueService: QueueService
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

    const bookingTime = new Date(fullBooking.timeSlot.startTime);

    // Планируем каждое напоминание
    for (let i = 0; i < fullBooking.reminders.length; i++) {
      const reminder = fullBooking.reminders[i];

      if (reminder.sent) {
        continue; // Уже отправлено
      }

      const scheduledTime = this.calculateReminderTime(
        bookingTime,
        reminder.timeValue,
        reminder.timeUnit
      );

      // Обновляем запланированное время
      fullBooking.reminders[i].scheduledFor = scheduledTime;

      const delayInMs = scheduledTime.getTime() - Date.now();

      if (delayInMs <= 0) {
        // Время уже прошло - отправляем сразу
        this.logger.log(
          `Reminder time has passed, sending immediately for booking ${booking.id}`
        );
        await this.sendReminder(fullBooking, i);
      } else {
        // Добавляем в очередь с задержкой
        this.logger.log(
          `Scheduling reminder for booking ${booking.id} in ${delayInMs}ms`
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
      if (!booking.specialist || !booking.service || !booking.timeSlot) {
        const loaded = await this.bookingRepository.findOne({
          where: { id: booking.id },
          relations: ["specialist", "service", "timeSlot"],
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

      // Находим бота
      const bot = await this.botRepository.findOne({
        where: { id: fullBooking.specialist.botId },
      });

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
    // TODO: Реализовать отмену задач в очереди
    this.logger.log(`Cancelling reminders for booking ${bookingId}`);
  }

  /**
   * Получает статистику по уведомлениям
   */
  async getReminderStats(botId: string): Promise<any> {
    const bookings = await this.bookingRepository
      .createQueryBuilder("booking")
      .leftJoin("booking.specialist", "specialist")
      .where("specialist.botId = :botId", { botId })
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
      // Загружаем полную информацию о бронировании
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ["specialist", "service", "timeSlot"],
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

      // Получаем бота
      const bot = await this.botRepository.findOne({
        where: { id: booking.specialist.botId },
      });

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
