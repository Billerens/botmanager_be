import { ApiProperty } from "@nestjs/swagger";
import {
  UserRole,
  TwoFactorType,
} from "../../../database/entities/user.entity";

export class UserResponseDto {
  @ApiProperty({
    description: "ID пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  telegramId: string;

  @ApiProperty({
    description: "Telegram username пользователя",
    example: "john_doe",
  })
  telegramUsername: string;

  @ApiProperty({
    description: "Имя",
    example: "Иван",
  })
  firstName: string;

  @ApiProperty({
    description: "Фамилия",
    example: "Петров",
  })
  lastName: string;

  @ApiProperty({
    description: "Роль пользователя",
    enum: UserRole,
    example: UserRole.OWNER,
  })
  role: UserRole;

  @ApiProperty({
    description: "Активен ли пользователь",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Верифицирован ли Telegram",
    example: true,
  })
  isTelegramVerified: boolean;

  @ApiProperty({
    description: "Дата последнего входа",
    example: "2024-01-15T10:30:00.000Z",
  })
  lastLoginAt: Date;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;

  @ApiProperty({
    description: "Включена ли двухфакторная аутентификация",
    example: false,
    required: false,
  })
  isTwoFactorEnabled?: boolean;

  @ApiProperty({
    description: "Тип двухфакторной аутентификации",
    enum: TwoFactorType,
    example: TwoFactorType.TELEGRAM,
    required: false,
  })
  twoFactorType?: TwoFactorType;
}

export class AuthResponseDto {
  @ApiProperty({
    description: "Информация о пользователе",
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: "JWT токен доступа",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;
}

export class VerificationRequiredResponseDto {
  @ApiProperty({
    description: "Информация о пользователе",
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: "Сообщение о необходимости верификации",
    example: "Требуется верификация Telegram",
  })
  message: string;

  @ApiProperty({
    description: "Требуется ли верификация Telegram",
    example: true,
  })
  requiresVerification: boolean;

  @ApiProperty({
    description: "Telegram ID пользователя для верификации",
    example: "123456789",
  })
  telegramId: string;
}

export class TwoFactorRequiredResponseDto {
  @ApiProperty({
    description: "Информация о пользователе",
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: "Сообщение о необходимости 2FA",
    example: "Требуется двухфакторная аутентификация",
  })
  message: string;

  @ApiProperty({
    description: "Требуется ли двухфакторная аутентификация",
    example: true,
  })
  requiresTwoFactor: boolean;

  @ApiProperty({
    description: "Telegram ID пользователя для 2FA",
    example: "123456789",
  })
  telegramId: string;
}
