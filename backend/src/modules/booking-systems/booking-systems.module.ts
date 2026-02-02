import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { BookingSystemUser } from "../../database/entities/booking-system-user.entity";
import { BookingSystemUserPermission } from "../../database/entities/booking-system-user-permission.entity";
import { BookingSystemInvitation } from "../../database/entities/booking-system-invitation.entity";
import { Bot } from "../../database/entities/bot.entity";
import { Shop } from "../../database/entities/shop.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { Service } from "../../database/entities/service.entity";
import { Booking } from "../../database/entities/booking.entity";
import { User } from "../../database/entities/user.entity";
import { BookingSystemsService } from "./booking-systems.service";
import { BookingSystemPermissionsService } from "./booking-system-permissions.service";
import { BookingSystemPermissionGuard } from "./guards/booking-system-permission.guard";
import { BookingSystemInvitationsService } from "./booking-system-invitations.service";
import { BookingSystemsController } from "./booking-systems.controller";
import { PublicBookingSystemsController } from "./public-booking-systems.controller";
import { ActivityLogModule } from "../activity-log/activity-log.module";
import { TelegramModule } from "../telegram/telegram.module";
import { CustomDomainsModule } from "../custom-domains/custom-domains.module";
import { BookingModule } from "../booking/booking.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingSystem,
      BookingSystemUser,
      BookingSystemUserPermission,
      BookingSystemInvitation,
      Bot,
      Shop,
      Specialist,
      Service,
      Booking,
      User,
    ]),
    ActivityLogModule,
    forwardRef(() => TelegramModule),
    forwardRef(() => CustomDomainsModule),
    forwardRef(() => BookingModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [BookingSystemsController, PublicBookingSystemsController],
  providers: [
    BookingSystemsService,
    BookingSystemPermissionsService,
    BookingSystemPermissionGuard,
    BookingSystemInvitationsService,
  ],
  exports: [
    BookingSystemsService,
    BookingSystemPermissionsService,
    BookingSystemPermissionGuard,
  ],
})
export class BookingSystemsModule {}
