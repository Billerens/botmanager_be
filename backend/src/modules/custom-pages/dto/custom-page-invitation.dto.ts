import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { CustomPageEntity } from "../../../database/entities/custom-page-user-permission.entity";
export class CreateCustomPageInvitationDto {
  @ApiProperty({ description: "Telegram ID приглашаемого пользователя" })
  @IsString()
  telegramId: string;

  @ApiProperty({
    description: "Разрешения для приглашаемого пользователя",
    type: "object",
  })
  @IsObject()
  permissions: Record<CustomPageEntity, PermissionAction[]>;

  @ApiProperty({
    description: "Персональное сообщение (опционально)",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class AcceptCustomPageInvitationDto {
  @ApiProperty({ description: "Токен приглашения" })
  @IsString()
  token: string;
}
