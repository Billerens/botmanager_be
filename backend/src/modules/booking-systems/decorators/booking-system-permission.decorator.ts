import { SetMetadata } from "@nestjs/common";
import { PermissionAction } from "../../../database/entities/bot-user-permission.entity";
import { BookingEntity } from "../../../database/entities/booking-system-user-permission.entity";
import { BookingSystemPermissionRequirement } from "../guards/booking-system-permission.guard";

export const BOOKING_SYSTEM_PERMISSIONS_KEY = "bookingSystemPermissions";

/**
 * Декоратор для проверки прав доступа к системе бронирования
 * @param entity - сущность системы бронирования
 * @param actions - требуемые действия
 */
export const BookingSystemPermission = (
  entity: BookingEntity,
  actions: PermissionAction | PermissionAction[]
) => {
  return SetMetadata(BOOKING_SYSTEM_PERMISSIONS_KEY, [
    {
      entity,
      actions: Array.isArray(actions) ? actions : [actions],
    },
  ]);
};

/**
 * Декоратор для проверки нескольких прав доступа к системе бронирования
 */
export const BookingSystemPermissions = (
  ...requirements: BookingSystemPermissionRequirement[]
) => {
  return SetMetadata(BOOKING_SYSTEM_PERMISSIONS_KEY, requirements);
};
