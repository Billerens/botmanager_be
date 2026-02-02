import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CustomPagePermissionsService } from "../custom-page-permissions.service";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { CustomPageEntity } from "../../../database/entities/custom-page-user-permission.entity";

export interface CustomPagePermissionRequirement {
  entity: CustomPageEntity;
  actions: PermissionAction[];
}

@Injectable()
export class CustomPagePermissionGuard implements CanActivate {
  private readonly logger = new Logger(CustomPagePermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private customPagePermissionsService: CustomPagePermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<
      CustomPagePermissionRequirement[]
    >("customPagePermissions", context.getHandler());

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const customPageId =
      request.params?.id ||
      request.params?.customPageId ||
      request.query?.customPageId ||
      request.body?.customPageId;

    this.logger.debug(
      `Checking custom page permissions for user ${user?.id}, customPageId: ${customPageId}`
    );

    if (!user) {
      throw new ForbiddenException("Пользователь не авторизован");
    }

    if (!customPageId) {
      this.logger.warn("customPageId не найден в параметрах запроса");
      throw new ForbiddenException(
        "customPageId (id) обязателен для проверки прав"
      );
    }

    for (const requirement of requiredPermissions) {
      for (const action of requirement.actions) {
        const hasPermission =
          await this.customPagePermissionsService.hasPermission(
            user.id,
            customPageId,
            requirement.entity,
            action
          );

        if (!hasPermission) {
          this.logger.warn(
            `Пользователь ${user.id} не имеет прав на ${action} для ${requirement.entity} на странице ${customPageId}`
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
