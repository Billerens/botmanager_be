import { IsString, IsEnum, IsOptional, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeadStatus, LeadSource } from '../../../database/entities/lead.entity';

export class CreateLeadDto {
  @ApiProperty({ description: 'ID бота' })
  @IsString()
  botId: string;

  @ApiProperty({ description: 'ID пользователя в Telegram' })
  @IsString()
  telegramUserId: string;

  @ApiProperty({ description: 'ID чата в Telegram', required: false })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiProperty({ description: 'Имя', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Фамилия', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: 'Телефон', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Данные формы' })
  @IsObject()
  formData: Record<string, any>;

  @ApiProperty({ description: 'Статус заявки', enum: LeadStatus, required: false })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiProperty({ description: 'Источник заявки', enum: LeadSource, required: false })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}

export class UpdateLeadDto {
  @ApiProperty({ description: 'Имя', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Фамилия', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Телефон', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Статус заявки', enum: LeadStatus, required: false })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiProperty({ description: 'Заметки', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Комментарии', required: false })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ description: 'Приоритет', required: false })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ description: 'Оценочная стоимость', required: false })
  @IsOptional()
  @IsNumber()
  estimatedValue?: number;
}
