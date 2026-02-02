import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { ShopEntity } from "../../../database/entities/shop-user-permission.entity";

export class CreateShopInvitationDto {
  @ApiProperty({ description: "Telegram ID приглашаемого пользователя" })
  @IsString()
  telegramId: string;

  @ApiProperty({
    description: "Разрешения для приглашаемого пользователя",
    type: "object",
  })
  @IsObject()
  permissions: Record<ShopEntity, PermissionAction[]>;

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
