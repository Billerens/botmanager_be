import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { Service } from "../../database/entities/service.entity";
import { Booking } from "../../database/entities/booking.entity";
import { BookingSystemsService } from "./booking-systems.service";
import { BookingSystemsController } from "./booking-systems.controller";
import { PublicBookingSystemsController } from "./public-booking-systems.controller";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { TelegramModule } from "../telegram/telegram.module";
import { CustomDomainsModule } from "../custom-domains/custom-domains.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingSystem,
      Bot,
      Specialist,
      Service,
      Booking,
    ]),
    ActivityLogModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => CustomDomainsModule),
  ],
  controllers: [BookingSystemsController, PublicBookingSystemsController],
  providers: [BookingSystemsService],
  exports: [BookingSystemsService],
})
export class BookingSystemsModule {}

