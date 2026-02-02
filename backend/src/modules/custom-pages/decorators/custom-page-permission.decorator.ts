import { SetMetadata } from "@nestjs/common";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { CustomPageEntity } from "../../../database/entities/custom-page-user-permission.entity";
import { CustomPagePermissionRequirement } from "../guards/custom-page-permission.guard";

export const CUSTOM_PAGE_PERMISSIONS_KEY = "customPagePermissions";

/**
 * Декоратор для проверки прав доступа к кастомной странице
 * @param entity - сущность страницы
 * @param actions - требуемые действия
 */
export const CustomPagePermission = (
  entity: CustomPageEntity,
  actions: PermissionAction | PermissionAction[]
) => {
  return SetMetadata(CUSTOM_PAGE_PERMISSIONS_KEY, [
    {
      entity,
      actions: Array.isArray(actions) ? actions : [actions],
    },
  ]);
};

/**
 * Декоратор для проверки нескольких прав доступа к кастомной странице
 */
export const CustomPagePermissions = (
  ...requirements: CustomPagePermissionRequirement[]
) => {
  return SetMetadata(CUSTOM_PAGE_PERMISSIONS_KEY, requirements);
};
