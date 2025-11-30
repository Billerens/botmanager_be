import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  BotEntity,
  PermissionAction,
} from "../../../database/entities/bot-user-permission.entity";

export class CreateBotUserDto {
  @ApiProperty({ description: "Telegram ID пользователя" })
  @IsString()
  telegramId: string;

  @ApiProperty({
    description: "Отображаемое имя пользователя",
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    description: "Разрешения пользователя",
    type: "object",
    example: {
      products: ["read", "create"],
      orders: ["read"],
    },
  })
  @IsObject()
  permissions: Record<BotEntity, PermissionAction[]>;
}

export class UpdateBotUserPermissionsDto {
  @ApiProperty({
    description: "Разрешения пользователя",
    type: "object",
  })
  @IsObject()
  permissions: Record<BotEntity, PermissionAction[]>;
}

export class BotUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  botId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  permissions: Record<BotEntity, PermissionAction[]>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: Object })
  user?: {
    id: string;
    telegramId: string;
    telegramUsername?: string;
    firstName?: string;
    lastName?: string;
  };
}
