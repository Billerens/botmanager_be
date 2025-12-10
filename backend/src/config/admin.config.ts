import { registerAs } from "@nestjs/config";

export interface AdminConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordRotationDays: number;
  passwordMinLength: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  requireTwoFactor: boolean;
  allowedIps: string[];
}

export default registerAs(
  "admin",
  (): AdminConfig => ({
    // JWT для админов - отдельный от основного
    jwtSecret:
      process.env.ADMIN_JWT_SECRET ||
      "admin-super-secret-key-change-in-production",
    jwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "4h", // Короткий срок для безопасности

    // Ротация паролей
    passwordRotationDays: parseInt(
      process.env.ADMIN_PASSWORD_ROTATION_DAYS || "30",
      10
    ),
    passwordMinLength: parseInt(
      process.env.ADMIN_PASSWORD_MIN_LENGTH || "12",
      10
    ),

    // Защита от брутфорса
    maxLoginAttempts: parseInt(
      process.env.ADMIN_MAX_LOGIN_ATTEMPTS || "5",
      10
    ),
    lockoutDurationMinutes: parseInt(
      process.env.ADMIN_LOCKOUT_DURATION_MINUTES || "30",
      10
    ),

    // Сессия
    sessionTimeoutMinutes: parseInt(
      process.env.ADMIN_SESSION_TIMEOUT_MINUTES || "60",
      10
    ),

    // 2FA
    requireTwoFactor: process.env.ADMIN_REQUIRE_TWO_FACTOR === "true",

    // IP whitelist (опционально)
    allowedIps: process.env.ADMIN_ALLOWED_IPS
      ? process.env.ADMIN_ALLOWED_IPS.split(",").map((ip) => ip.trim())
      : [],
  })
);

