import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, MoreThan } from "typeorm";
import {
  Booking,
  BookingStatus,
} from "../../../database/entities/booking.entity";
import { BookingNotificationsService } from "./booking-notifications.service";

/**
 * Сервис для периодического сканирования БД и восстановления пропущенных напоминаний
 * Работает как backup механизм на случай падения Redis/BullMQ
 */
@Injectable()
export class BookingReminderSchedulerService {
  private readonly logger = new Logger(BookingReminderSchedulerService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly notificationsService: BookingNotificationsService
  ) {}

  /**
   * Проверяет каждые 5 минут наличие неотправленных напоминаний
   * Это backup механизм на случай проблем с очередями
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingReminders(): Promise<void> {
    this.logger.log("Starting periodic reminder check...");

    try {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

      // Ищем бронирования с неотправленными напоминаниями
      // которые должны отправиться в ближайшие 30 минут
      const bookings = await this.bookingRepository
        .createQueryBuilder("booking")
        .leftJoinAndSelect("booking.timeSlot", "timeSlot")
        .leftJoinAndSelect("booking.specialist", "specialist")
        .leftJoinAndSelect("booking.service", "service")
        .where("booking.status IN (:...statuses)", {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .andWhere("booking.reminders IS NOT NULL")
        .andWhere("booking.telegramUserId IS NOT NULL")
        .andWhere("timeSlot.startTime > :now", { now })
        .andWhere("timeSlot.startTime < :maxTime", {
          maxTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // в ближайшие 48 часов
        })
        .getMany();

      this.logger.log(
        `Found ${bookings.length} bookings with reminders to check`
      );

      let processedCount = 0;
      let sentCount = 0;

      for (const booking of bookings) {
        if (!booking.reminders || booking.reminders.length === 0) {
          continue;
        }

        // Интерпретируем время слота как "время на часах" в локальном часовом поясе пользователя
        const clientTimezone = booking.clientData?.clientTimezone as
          | string
          | undefined;
        let bookingTime: Date;

        if (clientTimezone) {
          // Используем ту же логику конвертации, что и при планировании
          bookingTime = this.convertUTCTimeToLocal(
            new Date(booking.timeSlot.startTime),
            clientTimezone
          );
        } else {
          // Fallback: если timezone не указан, используем UTC время как есть
          bookingTime = new Date(booking.timeSlot.startTime);
        }

        for (let i = 0; i < booking.reminders.length; i++) {
          const reminder = booking.reminders[i];

          // Пропускаем уже отправленные
          if (reminder.sent) {
            continue;
          }

          // Рассчитываем время отправки
          const scheduledFor = reminder.scheduledFor
            ? new Date(reminder.scheduledFor)
            : this.calculateReminderTime(
                bookingTime,
                reminder.timeValue,
                reminder.timeUnit
              );

          // Проверяем, нужно ли отправлять сейчас
          // Отправляем если время наступило или прошло (независимо от просрочки)
          const timeDiff = scheduledFor.getTime() - now.getTime();
          const shouldSend = timeDiff <= 0; // Отправляем если время уже наступило или прошло

          if (shouldSend) {
            this.logger.log(
              `Sending missed/pending reminder for booking ${booking.id}, reminder ${i}, scheduled for ${scheduledFor.toISOString()}, now ${now.toISOString()}, diff ${Math.floor(timeDiff / 1000 / 60)} minutes`
            );
            await this.notificationsService.sendReminder(booking, i);
            sentCount++;
          }

          processedCount++;
        }
      }

      this.logger.log(
        `Reminder check completed. Processed: ${processedCount}, Sent: ${sentCount}`
      );
    } catch (error) {
      this.logger.error("Error during periodic reminder check:", error);
    }
  }

  /**
   * Проверяет и восстанавливает задачи после перезапуска
   * Вызывается при старте приложения
   */
  async restoreRemindersOnStartup(): Promise<void> {
    this.logger.log("Restoring reminders after startup...");

    try {
      await this.checkPendingReminders();
      this.logger.log("Reminder restoration completed");
    } catch (error) {
      this.logger.error("Error during reminder restoration:", error);
    }
  }

  /**
   * Конвертирует UTC время из БД в локальное время пользователя
   * Интерпретирует UTC время как "время на часах" в указанном часовом поясе
   * (копия логики из booking-notifications.service.ts)
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
}
