import { ApiProperty } from "@nestjs/swagger";
import {
  ActivityType,
  ActivityLevel,
} from "../../../database/entities/activity-log.entity";

export class ActivityLogResponseDto {
  @ApiProperty({
    description: "ID записи лога",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "ID пользователя",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  botId?: string;

  @ApiProperty({
    description: "Тип активности",
    enum: ActivityType,
    example: ActivityType.BOT_CREATED,
  })
  type: ActivityType;

  @ApiProperty({
    description: "Уровень активности",
    enum: ActivityLevel,
    example: ActivityLevel.INFO,
  })
  level: ActivityLevel;

  @ApiProperty({
    description: "Сообщение лога",
    example: "Бот успешно создан",
  })
  message: string;

  @ApiProperty({
    description: "Дополнительные данные",
    example: {
      botName: "Мой бот",
      botId: "123e4567-e89b-12d3-a456-426614174000",
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "IP адрес",
    example: "192.168.1.1",
    required: false,
  })
  ipAddress?: string;

  @ApiProperty({
    description: "User Agent",
    example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    required: false,
  })
  userAgent?: string;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;
}
