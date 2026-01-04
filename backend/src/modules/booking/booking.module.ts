import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Specialist } from "../../database/entities/specialist.entity";
import { Service } from "../../database/entities/service.entity";
import { TimeSlot } from "../../database/entities/time-slot.entity";
import { Booking } from "../../database/entities/booking.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";

// Сервисы
import { SpecialistsService } from "./services/specialists.service";
import { ServicesService } from "./services/services.service";
import { TimeSlotsService } from "./services/time-slots.service";
import { BookingsService } from "./services/bookings.service";
import { BookingNotificationsService } from "./services/booking-notifications.service";
import { BookingReminderSchedulerService } from "./services/booking-reminder-scheduler.service";

// Процессоры
import { BookingReminderProcessor } from "./processors/booking-reminder.processor";

// Модули
import { TelegramModule } from "../telegram/telegram.module";
import { QueueModule } from "../queue/queue.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Specialist,
      Service,
      TimeSlot,
      Booking,
      BookingSystem,
    ]),
    TelegramModule,
    QueueModule,
    WebSocketModule,
    ActivityLogModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [],
  providers: [
    SpecialistsService,
    ServicesService,
    TimeSlotsService,
    BookingsService,
    BookingNotificationsService,
    BookingReminderProcessor,
    BookingReminderSchedulerService,
  ],
  exports: [
    SpecialistsService,
    ServicesService,
    TimeSlotsService,
    BookingsService,
    BookingNotificationsService,
    BookingReminderSchedulerService,
  ],
})
export class BookingModule {
  constructor(
    private readonly reminderScheduler: BookingReminderSchedulerService
  ) {
    // Восстанавливаем напоминания при старте приложения
    this.reminderScheduler.restoreRemindersOnStartup();
  }
}
