import { SetMetadata } from "@nestjs/common";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { ShopEntity } from "../../../database/entities/shop-user-permission.entity";
import { ShopPermissionRequirement } from "../guards/shop-permission.guard";

export const SHOP_PERMISSIONS_KEY = "shopPermissions";

/**
 * Декоратор для проверки прав доступа к магазину
 * @param entity - сущность магазина
 * @param actions - требуемые действия
 */
export const ShopPermission = (
  entity: ShopEntity,
  actions: PermissionAction | PermissionAction[]
) => {
  return SetMetadata(SHOP_PERMISSIONS_KEY, [
    {
      entity,
      actions: Array.isArray(actions) ? actions : [actions],
    },
  ]);
};

/**
 * Декоратор для проверки нескольких прав доступа к магазину
 */
export const ShopPermissions = (
  ...requirements: ShopPermissionRequirement[]
) => {
  return SetMetadata(SHOP_PERMISSIONS_KEY, requirements);
};
