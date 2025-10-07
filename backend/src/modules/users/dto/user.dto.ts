import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class UpdateUserDto {
  @ApiProperty({ description: 'Email пользователя', example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @ApiProperty({ description: 'Имя', example: 'Иван', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Фамилия', example: 'Петров', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Telegram ID', example: '123456789', required: false })
  @IsOptional()
  @IsString()
  telegramId?: string;

  @ApiProperty({ description: 'Telegram username', example: 'username', required: false })
  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @ApiProperty({ description: 'Активен ли пользователь', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'Роль пользователя', enum: UserRole })
  @IsEnum(UserRole, { message: 'Некорректная роль пользователя' })
  role: UserRole;
}
