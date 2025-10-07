import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'ID пользователя' })
  id: string;

  @ApiProperty({ description: 'Email пользователя' })
  email: string;

  @ApiProperty({ description: 'Имя' })
  firstName: string;

  @ApiProperty({ description: 'Фамилия' })
  lastName: string;

  @ApiProperty({ description: 'Telegram ID' })
  telegramId: string;

  @ApiProperty({ description: 'Telegram username' })
  telegramUsername: string;

  @ApiProperty({ description: 'Роль пользователя', enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: 'Активен ли пользователь' })
  isActive: boolean;

  @ApiProperty({ description: 'Верифицирован ли email' })
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Дата последнего входа' })
  lastLoginAt: Date;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Информация о пользователе', type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ description: 'JWT токен доступа' })
  accessToken: string;
}
