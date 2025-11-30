import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BotPermissionsService } from "../bot-permissions.service";
import {
  PermissionAction,
  BotEntity,
} from "../../../database/entities/bot-user-permission.entity";

export interface BotPermissionRequirement {
  entity: BotEntity;
  actions: PermissionAction[];
}

@Injectable()
export class BotPermissionGuard implements CanActivate {
  private readonly logger = new Logger(BotPermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private botPermissionsService: BotPermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<BotPermissionRequirement[]>(
      "botPermissions",
      context.getHandler()
    );

    // Если декоратор не установлен, разрешаем доступ
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const botId = request.params?.id || request.params?.botId;

    if (!user) {
      throw new ForbiddenException("Пользователь не авторизован");
    }

    if (!botId) {
      this.logger.warn("botId не найден в параметрах запроса");
      throw new ForbiddenException("botId обязателен для проверки прав");
    }

    // Проверяем каждое требуемое разрешение
    for (const requirement of requiredPermissions) {
      // Проверяем, что пользователь имеет все требуемые действия для сущности
      for (const action of requirement.actions) {
        const hasPermission = await this.botPermissionsService.hasPermission(
          user.id,
          botId,
          requirement.entity,
          action
        );

        if (!hasPermission) {
          this.logger.warn(
            `Пользователь ${user.id} не имеет прав на ${action} для ${requirement.entity} в боте ${botId}`
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
