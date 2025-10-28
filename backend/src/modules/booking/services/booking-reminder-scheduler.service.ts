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

        const bookingTime = new Date(booking.timeSlot.startTime);

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
          // Отправляем, если время наступило (с буфером 1 минута)
          const shouldSend =
            scheduledFor.getTime() - now.getTime() <= 60 * 1000;

          if (shouldSend) {
            this.logger.log(
              `Sending missed/pending reminder for booking ${booking.id}, reminder ${i}`
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
