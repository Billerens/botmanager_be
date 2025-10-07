import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;

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
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;

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
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;
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
    description: "Email пользователя",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Некорректный email" })
  email: string;
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
