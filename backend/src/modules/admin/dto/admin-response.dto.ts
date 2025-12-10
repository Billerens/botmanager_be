import { Exclude, Expose, Type } from "class-transformer";
import { AdminRole, AdminStatus } from "../../../database/entities/admin.entity";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";

// Response DTO для админа
export class AdminResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  telegramId: string;

  @Expose()
  telegramUsername: string;

  @Expose()
  role: AdminRole;

  @Expose()
  status: AdminStatus;

  @Expose()
  isActive: boolean;

  @Expose()
  passwordChangedAt: Date;

  @Expose()
  passwordRotationDays: number;

  @Expose()
  passwordExpiresAt: Date;

  @Expose()
  passwordRecipientTelegramId: string;

  @Expose()
  lastLoginAt: Date;

  @Expose()
  lastActivityAt: Date;

  @Expose()
  isTwoFactorEnabled: boolean;

  @Expose()
  description: string;

  @Expose()
  permissions: Record<string, boolean>;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  get fullName(): string {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  @Expose()
  get isPasswordExpired(): boolean {
    if (!this.passwordExpiresAt) return false;
    return new Date() > new Date(this.passwordExpiresAt);
  }

  @Expose()
  get daysUntilPasswordExpires(): number {
    if (!this.passwordExpiresAt) return this.passwordRotationDays;
    const diff =
      new Date(this.passwordExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  // Скрываем чувствительные поля
  @Exclude()
  password: string;

  @Exclude()
  twoFactorSecret: string;

  @Exclude()
  twoFactorBackupCodes: string;

  @Exclude()
  twoFactorVerificationCode: string;

  @Exclude()
  twoFactorVerificationExpires: Date;
}

// Response DTO для логина
export class AdminLoginResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  @Type(() => AdminResponseDto)
  admin: AdminResponseDto;

  @Expose()
  expiresIn: string;

  @Expose()
  requiresTwoFactor?: boolean;

  @Expose()
  requiresPasswordChange?: boolean;
}

// Response DTO для лога действий
export class AdminActionLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  adminId: string;

  @Expose()
  actionType: AdminActionType;

  @Expose()
  level: AdminActionLevel;

  @Expose()
  description: string;

  @Expose()
  entityType: string;

  @Expose()
  entityId: string;

  @Expose()
  previousData: Record<string, any>;

  @Expose()
  newData: Record<string, any>;

  @Expose()
  metadata: Record<string, any>;

  @Expose()
  ipAddress: string;

  @Expose()
  userAgent: string;

  @Expose()
  requestUrl: string;

  @Expose()
  requestMethod: string;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => AdminResponseDto)
  admin?: AdminResponseDto;
}

// Response для пагинированного списка
export class PaginatedResponseDto<T> {
  @Expose()
  items: T[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  totalPages: number;

  @Expose()
  hasNextPage: boolean;

  @Expose()
  hasPreviousPage: boolean;
}

// Response для 2FA setup
export class TwoFactorSetupResponseDto {
  @Expose()
  secret: string;

  @Expose()
  qrCodeUrl: string;

  @Expose()
  backupCodes: string[];
}

// Response для статистики админки
export class AdminDashboardStatsDto {
  @Expose()
  totalUsers: number;

  @Expose()
  totalBots: number;

  @Expose()
  totalShops: number;

  @Expose()
  totalOrders: number;

  @Expose()
  totalLeads: number;

  @Expose()
  activeUsers: number;

  @Expose()
  todayOrders: number;

  @Expose()
  todayRevenue: number;

  @Expose()
  recentActivity: AdminActionLogResponseDto[];
}

