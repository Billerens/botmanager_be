import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  IsObject,
  Min,
  Max,
  IsEmail,
  IsPhoneNumber,
} from "class-validator";
import { Type } from "class-transformer";
import {
  BookingStatus,
  BookingSource,
} from "../../../database/entities/booking.entity";
import { WorkingHours } from "../../../database/entities/specialist.entity";

export class CreateSpecialistDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsObject()
  workingHours?: WorkingHours;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  defaultSlotDuration?: number = 30;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  bufferTime?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateSpecialistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  workingHours?: WorkingHours;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  defaultSlotDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  bufferTime?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  duration?: number = 30;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsString()
  specialistId: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateTimeSlotDto {
  @IsDateString()
  startTime: string; // ISO string в UTC

  @IsDateString()
  endTime: string; // ISO string в UTC

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsString()
  specialistId: string;
}

export class UpdateTimeSlotDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isBooked?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateBookingDto {
  @IsString()
  clientName: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  telegramUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource = BookingSource.MINI_APP;

  @IsOptional()
  @IsObject()
  clientData?: Record<string, any>;

  @IsString()
  specialistId: string;

  @IsString()
  serviceId: string;

  @IsString()
  timeSlotId: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsObject()
  clientData?: Record<string, any>;
}

export class ConfirmBookingDto {
  @IsString()
  confirmationCode: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}

export class GenerateTimeSlotsDto {
  @IsString()
  specialistId: string;

  @IsDateString()
  startDate: string; // ISO string в UTC

  @IsDateString()
  endDate: string; // ISO string в UTC

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  slotDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  bufferTime?: number;
}

export class GetAvailableSlotsDto {
  @IsString()
  specialistId: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsDateString()
  date: string; // ISO string в UTC
}

export class BookingSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowOnlineBooking?: boolean;

  @IsOptional()
  @IsBoolean()
  requireConfirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCancellation?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  cancellationTimeLimit?: number;

  @IsOptional()
  @IsBoolean()
  sendReminders?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  reminderTime?: number;

  @IsOptional()
  @IsBoolean()
  sendConfirmations?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  maxAdvanceBooking?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  minAdvanceBooking?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalFields?: string[];

  @IsOptional()
  @IsBoolean()
  calendarIntegration?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentIntegration?: boolean;
}
