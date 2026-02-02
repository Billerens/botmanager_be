import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { BookingEntity } from "../../../database/entities/booking-system-user-permission.entity";

export class CreateBookingSystemInvitationDto {
  @ApiProperty({ description: "Telegram ID приглашаемого пользователя" })
  @IsString()
  telegramId: string;

  @ApiProperty({
    description: "Разрешения для приглашаемого пользователя",
    type: "object",
  })
  @IsObject()
  permissions: Record<BookingEntity, PermissionAction[]>;

  @ApiProperty({
    description: "Персональное сообщение (опционально)",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class AcceptBookingSystemInvitationDto {
  @ApiProperty({ description: "Токен приглашения" })
  @IsString()
  token: string;
}
