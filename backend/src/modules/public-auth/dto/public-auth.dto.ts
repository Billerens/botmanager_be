import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PublicUserOwnerType } from "../../../database/entities/public-user.entity";

/**
 * DTO для регистрации публичного пользователя
 *
 * ownerId + ownerType определяют контекст регистрации (из каждой сущности — под её ownerType и ownerId):
 * - ownerType: 'user' + ownerId: userId — глобальный пользователь владельца аккаунта
 * - ownerType: 'bot' + ownerId: botId — пользователь конкретного бота
 * - ownerType: 'shop' + ownerId: shopId — пользователь магазина
 * - ownerType: 'booking' + ownerId: bookingSystemId — пользователь системы бронирования
 * - ownerType: 'custom_page' + ownerId: customPageId — пользователь кастомной страницы
 */
export class RegisterPublicUserDto {
  @ApiProperty({
    description: "ID владельца (userId, botId или shopId)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
    example: "user",
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType, { message: "Некорректный тип владельца" })
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный формат email" })
  email: string;

  @ApiProperty({
    description: "Пароль (минимум 6 символов)",
    example: "password123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Пароль должен содержать минимум 6 символов" })
  @MaxLength(100, { message: "Пароль слишком длинный" })
  password: string;

  @ApiPropertyOptional({
    description: "Имя пользователя",
    example: "Иван",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: "Фамилия пользователя",
    example: "Иванов",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: "Телефон пользователя",
    example: "+79001234567",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class LoginPublicUserDto {
  @ApiProperty({
    description: "ID владельца (userId, botId или shopId)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
    example: "user",
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType, { message: "Некорректный тип владельца" })
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный формат email" })
  email: string;

  @ApiProperty({
    description: "Пароль",
    example: "password123",
  })
  @IsString()
  password: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: "ID владельца",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType)
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный формат email" })
  email: string;

  @ApiProperty({
    description: "Код верификации из email",
    example: "123456",
  })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class ResendVerificationEmailDto {
  @ApiProperty({
    description: "ID владельца",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType)
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный формат email" })
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: "ID владельца",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType)
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный формат email" })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: "ID владельца",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({
    description: "Тип владельца",
    enum: PublicUserOwnerType,
    default: PublicUserOwnerType.USER,
  })
  @IsOptional()
  @IsEnum(PublicUserOwnerType)
  ownerType?: PublicUserOwnerType;

  @ApiProperty({
    description: "Токен сброса пароля",
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: "Новый пароль (минимум 6 символов)",
    example: "newpassword123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Пароль должен содержать минимум 6 символов" })
  @MaxLength(100, { message: "Пароль слишком длинный" })
  newPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh токен",
  })
  @IsString()
  refreshToken: string;
}

export class UpdatePublicUserProfileDto {
  @ApiPropertyOptional({
    description: "Имя пользователя",
    example: "Иван",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: "Фамилия пользователя",
    example: "Иванов",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: "Телефон пользователя",
    example: "+79001234567",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class ChangePublicUserPasswordDto {
  @ApiProperty({
    description: "Текущий пароль",
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: "Новый пароль (минимум 6 символов)",
    example: "newpassword123",
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: "Пароль должен содержать минимум 6 символов" })
  @MaxLength(100, { message: "Пароль слишком длинный" })
  newPassword: string;
}

export class LinkTelegramDto {
  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  @IsString()
  telegramId: string;

  @ApiPropertyOptional({
    description: "Telegram username",
    example: "username",
  })
  @IsOptional()
  @IsString()
  telegramUsername?: string;
}
