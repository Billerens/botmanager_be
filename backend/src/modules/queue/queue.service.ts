import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue("message-queue") private messageQueue: Queue,
    @InjectQueue("webhook-queue") private webhookQueue: Queue,
    @InjectQueue("booking-reminder-queue") private bookingReminderQueue: Queue
  ) {}

  async addMessageJob(data: any) {
    return this.messageQueue.add("process-message", data);
  }

  async addWebhookJob(data: any) {
    return this.webhookQueue.add("process-webhook", data);
  }

  /**
   * Добавляет задачу напоминания о бронировании с задержкой
   */
  async addBookingReminderJob(
    data: { bookingId: string; reminderIndex: number },
    delayInMs: number
  ) {
    return this.bookingReminderQueue.add("send-booking-reminder", data, {
      delay: delayInMs,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Отменяет все задачи напоминаний для конкретного бронирования
   */
  async cancelBookingReminders(bookingId: string): Promise<number> {
    const jobs = await this.bookingReminderQueue.getJobs([
      "delayed",
      "waiting",
    ]);
    let cancelledCount = 0;

    for (const job of jobs) {
      if (job.data.bookingId === bookingId) {
        await job.remove();
        cancelledCount++;
      }
    }

    return cancelledCount;
  }
}
