import { UserRole } from "../../../database/entities/user.entity";

export interface JwtPayload {
  sub: string; // User ID
  telegramId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
