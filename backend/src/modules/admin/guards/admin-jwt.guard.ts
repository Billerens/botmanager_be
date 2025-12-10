import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { SetMetadata } from "@nestjs/common";

// Декоратор для публичных эндпоинтов (например, логин)
export const ADMIN_PUBLIC_KEY = "isAdminPublic";
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC_KEY, true);

// Декоратор для указания требуемой роли
export const ADMIN_ROLES_KEY = "adminRoles";
export const AdminRoles = (...roles: string[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);

@Injectable()
export class AdminJwtGuard extends AuthGuard("admin-jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Проверяем, помечен ли эндпоинт как публичный
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      ADMIN_PUBLIC_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, admin: any, info: any) {
    if (err || !admin) {
      throw (
        err ||
        new UnauthorizedException(
          "Требуется авторизация администратора"
        )
      );
    }
    return admin;
  }
}

