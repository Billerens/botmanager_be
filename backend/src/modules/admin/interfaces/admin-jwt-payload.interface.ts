import { AdminRole } from "../../../database/entities/admin.entity";

export interface AdminJwtPayload {
  sub: string; // Admin ID
  username: string;
  role: AdminRole;
  isAdmin: true; // Маркер для отличия от обычных пользователей
  iat?: number;
  exp?: number;
}

