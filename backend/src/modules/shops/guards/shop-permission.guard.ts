import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ShopPermissionsService } from "../shop-permissions.service";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { ShopEntity } from "../../../database/entities/shop-user-permission.entity";

export interface ShopPermissionRequirement {
  entity: ShopEntity;
  actions: PermissionAction[];
}

@Injectable()
export class ShopPermissionGuard implements CanActivate {
  private readonly logger = new Logger(ShopPermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private shopPermissionsService: ShopPermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<ShopPermissionRequirement[]>(
      "shopPermissions",
      context.getHandler()
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const shopId =
      request.params?.shopId ||
      request.params?.id ||
      request.query?.shopId ||
      request.body?.shopId;

    this.logger.debug(
      `Checking shop permissions for user ${user?.id}, shopId: ${shopId}`
    );

    if (!user) {
      throw new ForbiddenException("Пользователь не авторизован");
    }

    if (!shopId) {
      this.logger.warn("shopId не найден в параметрах запроса");
      throw new ForbiddenException("shopId обязателен для проверки прав");
    }

    for (const requirement of requiredPermissions) {
      for (const action of requirement.actions) {
        const hasPermission = await this.shopPermissionsService.hasPermission(
          user.id,
          shopId,
          requirement.entity,
          action
        );

        if (!hasPermission) {
          this.logger.warn(
            `Пользователь ${user.id} не имеет прав на ${action} для ${requirement.entity} в магазине ${shopId}`
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
