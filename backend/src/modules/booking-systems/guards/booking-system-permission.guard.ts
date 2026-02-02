import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BookingSystemPermissionsService } from "../booking-system-permissions.service";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { BookingEntity } from "../../../database/entities/booking-system-user-permission.entity";

export interface BookingSystemPermissionRequirement {
  entity: BookingEntity;
  actions: PermissionAction[];
}

@Injectable()
export class BookingSystemPermissionGuard implements CanActivate {
  private readonly logger = new Logger(BookingSystemPermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private bookingSystemPermissionsService: BookingSystemPermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<
      BookingSystemPermissionRequirement[]
    >("bookingSystemPermissions", context.getHandler());

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const bookingSystemId =
      request.params?.bookingSystemId ||
      request.params?.id ||
      request.query?.bookingSystemId ||
      request.body?.bookingSystemId;

    this.logger.debug(
      `Checking booking system permissions for user ${user?.id}, bookingSystemId: ${bookingSystemId}`
    );

    if (!user) {
      throw new ForbiddenException("Пользователь не авторизован");
    }

    if (!bookingSystemId) {
      this.logger.warn("bookingSystemId не найден в параметрах запроса");
      throw new ForbiddenException(
        "bookingSystemId (id) обязателен для проверки прав"
      );
    }

    for (const requirement of requiredPermissions) {
      for (const action of requirement.actions) {
        const hasPermission =
          await this.bookingSystemPermissionsService.hasPermission(
            user.id,
            bookingSystemId,
            requirement.entity,
            action
          );

        if (!hasPermission) {
          this.logger.warn(
            `Пользователь ${user.id} не имеет прав на ${action} для ${requirement.entity} в системе бронирования ${bookingSystemId}`
          );
          throw new ForbiddenException(
            `Недостаточно прав для выполнения операции с ${requirement.entity}`
          );
        }
      }
    }

    return true;
  }
}
