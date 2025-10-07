import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActivityType, ActivityLevel } from '../../../database/entities/activity-log.entity';

export class CreateActivityLogDto {
  @ApiProperty({ description: 'Тип активности', enum: ActivityType })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({ description: 'Уровень активности', enum: ActivityLevel })
  @IsEnum(ActivityLevel)
  level: ActivityLevel;

  @ApiProperty({ description: 'Сообщение' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Метаданные', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'IP адрес', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'User Agent', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'ID пользователя', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'ID бота', required: false })
  @IsOptional()
  @IsString()
  botId?: string;
}
