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

// Контроллеры
import { SpecialistsController } from "./controllers/specialists.controller";
import { ServicesController } from "./controllers/services.controller";
import { TimeSlotsController } from "./controllers/time-slots.controller";
import { BookingsController } from "./controllers/bookings.controller";
import { PublicBookingController } from "./controllers/public-booking.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Specialist, Service, TimeSlot, Booking, Bot]),
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
  ],
  exports: [
    SpecialistsService,
    ServicesService,
    TimeSlotsService,
    BookingsService,
    BookingMiniAppService,
  ],
})
export class BookingModule {}
