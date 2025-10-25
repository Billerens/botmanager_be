import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({
    description: "Статус ошибки",
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке",
    example: "Lead not found",
  })
  message: string;

  @ApiProperty({
    description: "Код ошибки",
    example: "LEAD_NOT_FOUND",
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: "Дополнительные детали ошибки",
    example: {
      timestamp: "2024-01-15T10:30:00.000Z",
      leadId: "123e4567-e89b-12d3-a456-426614174000",
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class LeadResponseDto {
  @ApiProperty({
    description: "ID заявки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
  })
  telegramUserId: string;

  @ApiProperty({
    description: "Имя клиента",
    example: "Иван Петров",
  })
  clientName: string;

  @ApiProperty({
    description: "Телефон клиента",
    example: "+7 (999) 123-45-67",
    required: false,
  })
  clientPhone?: string;

  @ApiProperty({
    description: "Email клиента",
    example: "ivan@example.com",
    required: false,
  })
  clientEmail?: string;

  @ApiProperty({
    description: "Статус заявки",
    example: "new",
  })
  status: string;

  @ApiProperty({
    description: "Источник заявки",
    example: "telegram_bot",
  })
  source: string;

  @ApiProperty({
    description: "Сообщение клиента",
    example: "Хочу заказать услугу маникюра",
  })
  message: string;

  @ApiProperty({
    description: "Дополнительные данные",
    example: {
      preferredTime: "18:00",
      serviceType: "Маникюр",
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class DeleteResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Lead successfully deleted",
  })
  message: string;

  @ApiProperty({
    description: "ID удаленной заявки",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  deletedId: string;

  @ApiProperty({
    description: "Дата удаления",
    example: "2024-01-15T10:30:00.000Z",
  })
  deletedAt: Date;
}

export class LeadStatsResponseDto {
  @ApiProperty({
    description: "Общее количество заявок",
    example: 500,
  })
  totalLeads: number;

  @ApiProperty({
    description: "Количество новых заявок",
    example: 50,
  })
  newLeads: number;

  @ApiProperty({
    description: "Количество обработанных заявок",
    example: 400,
  })
  processedLeads: number;

  @ApiProperty({
    description: "Количество заявок за последние 7 дней",
    example: 75,
  })
  leadsLast7Days: number;

  @ApiProperty({
    description: "Среднее время обработки заявки (часы)",
    example: 2.5,
  })
  averageProcessingTime: number;

  @ApiProperty({
    description: "Конверсия заявок в клиентов (%)",
    example: 75.5,
  })
  conversionRate: number;
}
