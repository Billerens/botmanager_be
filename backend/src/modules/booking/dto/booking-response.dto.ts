import { ApiProperty } from "@nestjs/swagger";
import {
  BookingStatus,
  BookingSource,
} from "../../../database/entities/booking.entity";
import { WorkingHours } from "../../../database/entities/specialist.entity";

export class ErrorResponseDto {
  @ApiProperty({
    description: "Статус ошибки",
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке",
    example: "Invalid data provided",
  })
  message: string;

  @ApiProperty({
    description: "Код ошибки",
    example: "VALIDATION_ERROR",
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: "Дополнительные детали ошибки",
    example: {
      timestamp: "2024-01-15T10:30:00.000Z",
      field: "startTime",
      value: "invalid_date",
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class DeleteResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Successfully deleted",
  })
  message: string;

  @ApiProperty({
    description: "ID удаленного объекта",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  deletedId: string;

  @ApiProperty({
    description: "Дата удаления",
    example: "2024-01-15T10:30:00.000Z",
  })
  deletedAt: Date;
}

export class CleanupResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Cleaned up 15 past time slots",
  })
  message: string;

  @ApiProperty({
    description: "Количество удаленных объектов",
    example: 15,
  })
  deletedCount: number;

  @ApiProperty({
    description: "Дата очистки",
    example: "2024-01-15T10:30:00.000Z",
  })
  cleanedAt: Date;
}

export class ScheduleResponseDto {
  @ApiProperty({
    description: "ID специалиста",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  specialistId: string;

  @ApiProperty({
    description: "Дата расписания",
    example: "2024-01-15",
  })
  date: string;

  @ApiProperty({
    description: "Рабочие часы",
    example: {
      start: "09:00",
      end: "18:00",
      isWorking: true,
    },
  })
  workingHours: Record<string, any>;

  @ApiProperty({
    description: "Доступные таймслоты",
    example: [
      {
        id: "slot1",
        startTime: "09:00",
        endTime: "10:00",
        isAvailable: true,
      },
    ],
  })
  timeSlots: Array<Record<string, any>>;

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
}

export class SpecialistResponseDto {
  @ApiProperty({
    description: "ID специалиста",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Имя специалиста",
    example: "Анна Иванова",
  })
  name: string;

  @ApiProperty({
    description: "Описание специалиста",
    example: "Опытный мастер маникюра с 5-летним стажем",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "URL аватара специалиста",
    example: "https://example.com/avatar.jpg",
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: "Телефон специалиста",
    example: "+7 (999) 123-45-67",
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: "Email специалиста",
    example: "anna@example.com",
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: "Активен ли специалист",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Рабочие часы специалиста",
    example: {
      monday: { start: "09:00", end: "18:00", isWorking: true },
      tuesday: { start: "09:00", end: "18:00", isWorking: true },
      wednesday: { start: "09:00", end: "18:00", isWorking: true },
      thursday: { start: "09:00", end: "18:00", isWorking: true },
      friday: { start: "09:00", end: "18:00", isWorking: true },
      saturday: { start: "10:00", end: "16:00", isWorking: true },
      sunday: { start: "10:00", end: "16:00", isWorking: false },
    },
    required: false,
  })
  workingHours?: WorkingHours;

  @ApiProperty({
    description: "Длительность слота по умолчанию (минуты)",
    example: 30,
  })
  defaultSlotDuration: number;

  @ApiProperty({
    description: "Время буфера между записями (минуты)",
    example: 15,
  })
  bufferTime: number;

  @ApiProperty({
    description: "Заметки о специалисте",
    example: "Работает только с натуральными материалами",
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: "Дополнительные данные",
    example: { experience: "5 years", certifications: ["Nail Master"] },
    required: false,
  })
  metadata?: Record<string, any>;

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
}

export class ServiceResponseDto {
  @ApiProperty({
    description: "ID услуги",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название услуги",
    example: "Маникюр классический",
  })
  name: string;

  @ApiProperty({
    description: "Описание услуги",
    example: "Классический маникюр с покрытием лаком",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Цена услуги",
    example: 1500,
    required: false,
  })
  price?: number;

  @ApiProperty({
    description: "Длительность услуги (минуты)",
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: "Активна ли услуга",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Категория услуги",
    example: "Маникюр",
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: "Требования к услуге",
    example: ["Чистые руки", "Отсутствие грибковых заболеваний"],
    required: false,
  })
  requirements?: string[];

  @ApiProperty({
    description: "Заметки об услуге",
    example: "Включает покрытие базовым и топовым лаком",
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: "Дополнительные данные",
    example: {
      materials: ["Лак", "База", "Топ"],
      tools: ["Пилка", "Кутикула"],
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "ID специалиста",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  specialistId: string;

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
}

export class TimeSlotResponseDto {
  @ApiProperty({
    description: "ID временного слота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Время начала слота",
    example: "2024-01-15T10:00:00.000Z",
  })
  startTime: Date;

  @ApiProperty({
    description: "Время окончания слота",
    example: "2024-01-15T11:00:00.000Z",
  })
  endTime: Date;

  @ApiProperty({
    description: "Доступен ли слот для бронирования",
    example: true,
  })
  isAvailable: boolean;

  @ApiProperty({
    description: "Забронирован ли слот",
    example: false,
  })
  isBooked: boolean;

  @ApiProperty({
    description: "Дополнительные данные",
    example: { notes: "Особые условия" },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "ID специалиста",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  specialistId: string;

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
}

export class BookingResponseDto {
  @ApiProperty({
    description: "ID бронирования",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Имя клиента",
    example: "Мария Петрова",
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
    example: "maria@example.com",
    required: false,
  })
  clientEmail?: string;

  @ApiProperty({
    description: "Telegram ID пользователя",
    example: "123456789",
    required: false,
  })
  telegramUserId?: string;

  @ApiProperty({
    description: "Статус бронирования",
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @ApiProperty({
    description: "Источник бронирования",
    enum: BookingSource,
    example: BookingSource.MINI_APP,
  })
  source: BookingSource;

  @ApiProperty({
    description: "Заметки к бронированию",
    example: "Клиент просит не использовать гель-лак",
    required: false,
  })
  notes?: string;

  @ApiProperty({
    description: "Причина отмены",
    example: "Клиент не явился",
    required: false,
  })
  cancellationReason?: string;

  @ApiProperty({
    description: "Код подтверждения",
    example: "ABC123",
    required: false,
  })
  confirmationCode?: string;

  @ApiProperty({
    description: "Дополнительные данные клиента",
    example: { preferences: "Без гель-лака", allergies: "Нет" },
    required: false,
  })
  clientData?: Record<string, any>;

  @ApiProperty({
    description: "ID специалиста",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  specialistId: string;

  @ApiProperty({
    description: "ID услуги",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  serviceId: string;

  @ApiProperty({
    description: "ID временного слота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  timeSlotId: string;

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
}

export class BookingStatsResponseDto {
  @ApiProperty({
    description: "Общее количество бронирований",
    example: 150,
  })
  totalBookings: number;

  @ApiProperty({
    description: "Количество подтвержденных бронирований",
    example: 120,
  })
  confirmedBookings: number;

  @ApiProperty({
    description: "Количество отмененных бронирований",
    example: 15,
  })
  cancelledBookings: number;

  @ApiProperty({
    description: "Количество бронирований за последние 7 дней",
    example: 25,
  })
  bookingsLast7Days: number;

  @ApiProperty({
    description: "Средний доход за месяц",
    example: 45000,
  })
  averageMonthlyRevenue: number;
}
