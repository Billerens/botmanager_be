import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../../database/entities/booking.entity';
import { BookingNotificationsService } from '../services/booking-notifications.service';

@Processor('booking-reminder-queue')
export class BookingReminderProcessor {
  private readonly logger = new Logger(BookingReminderProcessor.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly notificationsService: BookingNotificationsService,
  ) {}

  @Process('send-booking-reminder')
  async handleReminder(job: Job<{ bookingId: string; reminderIndex: number }>) {
    const { bookingId, reminderIndex } = job.data;

    this.logger.log(
      `Processing booking reminder: bookingId=${bookingId}, reminderIndex=${reminderIndex}`,
    );

    try {
      // Загружаем бронирование
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: ['specialist', 'service', 'timeSlot'],
      });

      if (!booking) {
        this.logger.error(`Booking ${bookingId} not found`);
        return;
      }

      // Проверяем, что напоминание ещё не было отправлено
      if (
        booking.reminders &&
        booking.reminders[reminderIndex] &&
        !booking.reminders[reminderIndex].sent
      ) {
        // Отправляем напоминание
        await this.notificationsService.sendReminder(booking, reminderIndex);
        this.logger.log(
          `Successfully sent reminder for booking ${bookingId}, index ${reminderIndex}`,
        );
      } else {
        this.logger.warn(
          `Reminder already sent or not found for booking ${bookingId}, index ${reminderIndex}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process reminder for booking ${bookingId}:`,
        error.stack,
      );
      throw error; // Повторная попытка благодаря настройкам retry
    }
  }
}

