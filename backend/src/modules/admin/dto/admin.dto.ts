import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  IsObject,
} from "class-validator";
import { AdminRole, AdminStatus } from "../../../database/entities/admin.entity";

// DTO для логина админа
export class AdminLoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}

// DTO для создания админа
export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(12)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  telegramId: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsNumber()
  passwordRotationDays?: number;

  @IsOptional()
  @IsString()
  passwordRecipientTelegramId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}

// DTO для обновления админа
export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  passwordRotationDays?: number;

  @IsOptional()
  @IsString()
  passwordRecipientTelegramId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}

// DTO для смены пароля
export class ChangeAdminPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string; // Не требуется при принудительной смене

  @IsString()
  @MinLength(12)
  newPassword: string;
}

// DTO для сброса пароля другого админа (только superadmin)
export class ResetAdminPasswordDto {
  @IsString()
  adminId: string;
}

// DTO для настройки 2FA
export class SetupTwoFactorDto {
  @IsString()
  secret: string;

  @IsString()
  code: string;
}

// DTO для верификации 2FA
export class VerifyTwoFactorDto {
  @IsString()
  code: string;
}

// DTO для фильтрации логов действий
export class AdminActionLogFilterDto {
  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

// DTO для настройки ротации паролей
export class PasswordRotationSettingsDto {
  @IsNumber()
  rotationDays: number;

  @IsString()
  recipientTelegramId: string;
}

