import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../../../database/entities/user.entity";

export class UserResponseDto {
  @ApiProperty({ description: "ID пользователя" })
  id: string;

  @ApiProperty({ description: "Telegram ID пользователя" })
  telegramId: string;

  @ApiProperty({ description: "Telegram username пользователя" })
  telegramUsername: string;

  @ApiProperty({ description: "Имя" })
  firstName: string;

  @ApiProperty({ description: "Фамилия" })
  lastName: string;

  @ApiProperty({ description: "Роль пользователя", enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: "Активен ли пользователь" })
  isActive: boolean;

  @ApiProperty({ description: "Верифицирован ли Telegram" })
  isTelegramVerified: boolean;

  @ApiProperty({ description: "Дата последнего входа" })
  lastLoginAt: Date;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: "Информация о пользователе",
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({ description: "JWT токен доступа" })
  accessToken: string;
}

export class VerificationRequiredResponseDto {
  @ApiProperty({
    description: "Информация о пользователе",
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({ description: "Сообщение о необходимости верификации" })
  message: string;

  @ApiProperty({ description: "Требуется ли верификация Telegram" })
  requiresVerification: boolean;

  @ApiProperty({ description: "Telegram ID пользователя для верификации" })
  telegramId: string;
}
