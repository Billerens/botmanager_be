import { SetMetadata } from "@nestjs/common";
import {
  BotEntity,
  PermissionAction,
} from "../../../database/entities/bot-user-permission.entity";
import { BotPermissionRequirement } from "../guards/bot-permission.guard";

export const BOT_PERMISSIONS_KEY = "botPermissions";

/**
 * Декоратор для проверки прав доступа к боту
 * @param entity - сущность бота
 * @param actions - требуемые действия
 */
export const BotPermission = (
  entity: BotEntity,
  actions: PermissionAction | PermissionAction[]
) => {
  return SetMetadata(BOT_PERMISSIONS_KEY, [
    {
      entity,
      actions: Array.isArray(actions) ? actions : [actions],
    },
  ]);
};

/**
 * Декоратор для проверки нескольких прав доступа к боту
 * @param requirements - массив требований к правам
 */
export const BotPermissions = (...requirements: BotPermissionRequirement[]) => {
  return SetMetadata(BOT_PERMISSIONS_KEY, requirements);
};
