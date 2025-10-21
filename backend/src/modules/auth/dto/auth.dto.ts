import { IsString, MinLength, IsOptional, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "Telegram ID пользователя (число)",
    example: "123456789",
  })
  @IsString()
  @IsNotEmpty({ message: "Telegram ID обязателен" })
  telegramId: string;

  @ApiProperty({
    description: "Telegram username пользователя (необязательно)",
    example: "username",
    required: false,
  })
  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @ApiProperty({ description: "Пароль", example: "password123", minLength: 6 })
  @IsString()
  @MinLength(6, { message: "Пароль должен содержать минимум 6 символов" })
  password: string;

  @ApiProperty({ description: "Имя", example: "Иван", required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: "Фамилия", example: "Петров", required: false })
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  @IsString()
  @IsNotEmpty({ message: "Telegram ID обязателен" })
  telegramId: string;

  @ApiProperty({ description: "Пароль", example: "password123" })
  @IsString()
  @IsNotEmpty({ message: "Пароль обязателен" })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: "Текущий пароль", example: "oldpassword123" })
  @IsString()
  @IsNotEmpty({ message: "Текущий пароль обязателен" })
  currentPassword: string;

  @ApiProperty({
    description: "Новый пароль",
    example: "newpassword123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Новый пароль должен содержать минимум 6 символов" })
  newPassword: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  @IsString()
  @IsNotEmpty({ message: "Telegram ID обязателен" })
  telegramId: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Токен сброса пароля" })
  @IsString()
  @IsNotEmpty({ message: "Токен обязателен" })
  token: string;

  @ApiProperty({
    description: "Новый пароль",
    example: "newpassword123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Новый пароль должен содержать минимум 6 символов" })
  newPassword: string;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  @IsString()
  @IsNotEmpty({ message: "Telegram ID обязателен" })
  telegramId: string;
}

export class VerifyTelegramCodeDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  @IsString()
  @IsNotEmpty({ message: "Telegram ID обязателен" })
  telegramId: string;

  @ApiProperty({
    description: "6-значный код верификации",
    example: "123456",
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Код должен содержать 6 символов" })
  @IsNotEmpty({ message: "Код верификации обязателен" })
  code: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Имя", required: false })
  firstName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Фамилия", required: false })
  lastName?: string;
}
