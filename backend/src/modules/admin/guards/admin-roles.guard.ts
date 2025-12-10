import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdminRole } from "../../../database/entities/admin.entity";
import { ADMIN_ROLES_KEY } from "./admin-jwt.guard";

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // Если роли не указаны, разрешаем доступ
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.user;

    if (!admin) {
      throw new ForbiddenException("Администратор не найден в запросе");
    }

    // Superadmin имеет доступ ко всему
    if (admin.role === AdminRole.SUPERADMIN) {
      return true;
    }

    // Проверяем, есть ли у админа требуемая роль
    const hasRole = requiredRoles.some((role) => admin.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Недостаточно прав. Требуется роль: ${requiredRoles.join(" или ")}`
      );
    }

    return true;
  }
}

