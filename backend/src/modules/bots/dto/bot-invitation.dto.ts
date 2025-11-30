import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  BotEntity,
  PermissionAction,
} from "../../../database/entities/bot-user-permission.entity";
import { BotInvitationStatus } from "../../../database/entities/bot-invitation.entity";

export class CreateBotInvitationDto {
  @ApiProperty({ description: "Telegram ID приглашаемого пользователя" })
  @IsString()
  telegramId: string;

  @ApiProperty({
    description: "Разрешения для приглашаемого пользователя",
    type: "object",
  })
  @IsObject()
  permissions: Record<BotEntity, PermissionAction[]>;

  @ApiProperty({
    description: "Персональное сообщение (опционально)",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: "Токен приглашения" })
  @IsString()
  token: string;
}

export class BotInvitationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  botId: string;

  @ApiProperty()
  invitedTelegramId: string;

  @ApiProperty({ nullable: true })
  invitedUserId?: string;

  @ApiProperty({ enum: BotInvitationStatus })
  status: BotInvitationStatus;

  @ApiProperty()
  permissions: Record<BotEntity, PermissionAction[]>;

  @ApiProperty()
  invitedByUserId: string;

  @ApiProperty()
  invitationToken: string;

  @ApiProperty({ nullable: true })
  expiresAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: Object })
  bot?: {
    id: string;
    name: string;
    username: string;
  };

  @ApiProperty({ type: Object })
  invitedByUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };

  @ApiProperty({ type: Object, nullable: true })
  invitedUser?: {
    id: string;
    telegramId: string;
    telegramUsername?: string;
    firstName?: string;
    lastName?: string;
  };
}
