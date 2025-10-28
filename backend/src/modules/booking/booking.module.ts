import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Specialist } from "../../database/entities/specialist.entity";
import { Service } from "../../database/entities/service.entity";
import { TimeSlot } from "../../database/entities/time-slot.entity";
import { Booking } from "../../database/entities/booking.entity";
import { Bot } from "../../database/entities/bot.entity";

// Сервисы
import { SpecialistsService } from "./services/specialists.service";
import { ServicesService } from "./services/services.service";
import { TimeSlotsService } from "./services/time-slots.service";
import { BookingsService } from "./services/bookings.service";
import { BookingMiniAppService } from "./services/booking-mini-app.service";
import { BookingNotificationsService } from "./services/booking-notifications.service";

// Контроллеры
import { SpecialistsController } from "./controllers/specialists.controller";
import { ServicesController } from "./controllers/services.controller";
import { TimeSlotsController } from "./controllers/time-slots.controller";
import { BookingsController } from "./controllers/bookings.controller";
import { PublicBookingController } from "./controllers/public-booking.controller";

// Процессоры
import { BookingReminderProcessor } from "./processors/booking-reminder.processor";

// Модули
import { TelegramModule } from "../telegram/telegram.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Specialist, Service, TimeSlot, Booking, Bot]),
    TelegramModule,
    QueueModule,
  ],
  controllers: [
    SpecialistsController,
    ServicesController,
    TimeSlotsController,
    BookingsController,
    PublicBookingController,
  ],
  providers: [
    SpecialistsService,
    ServicesService,
    TimeSlotsService,
    BookingsService,
    BookingMiniAppService,
    BookingNotificationsService,
    BookingReminderProcessor,
  ],
  exports: [
    SpecialistsService,
    ServicesService,
    TimeSlotsService,
    BookingsService,
    BookingMiniAppService,
    BookingNotificationsService,
  ],
})
export class BookingModule {}
