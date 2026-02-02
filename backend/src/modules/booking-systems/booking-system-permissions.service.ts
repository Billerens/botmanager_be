import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookingSystemUser } from "../../database/entities/booking-system-user.entity";
import {
  BookingSystemUserPermission,
  BookingEntity,
} from "../../database/entities/booking-system-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { User } from "../../database/entities/user.entity";

@Injectable()
export class BookingSystemPermissionsService {
  constructor(
    @InjectRepository(BookingSystemUser)
    private bookingSystemUserRepository: Repository<BookingSystemUser>,
    @InjectRepository(BookingSystemUserPermission)
    private permissionRepository: Repository<BookingSystemUserPermission>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async hasAccessToBookingSystem(
    userId: string,
    bookingSystemId: string
  ): Promise<boolean> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId, ownerId: userId },
    });
    if (bs) return true;

    const bsUser = await this.bookingSystemUserRepository.findOne({
      where: { bookingSystemId, userId },
    });
    return !!bsUser;
  }

  async hasPermission(
    userId: string,
    bookingSystemId: string,
    entity: BookingEntity,
    action: PermissionAction
  ): Promise<boolean> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId, ownerId: userId },
    });
    if (bs) return true;

    const permission = await this.permissionRepository.findOne({
      where: { bookingSystemId, userId, entity, action },
    });
    return permission?.granted ?? false;
  }

  async getUserPermissions(
    userId: string,
    bookingSystemId: string
  ): Promise<Record<BookingEntity, PermissionAction[]>> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId, ownerId: userId },
    });
    if (bs) {
      const allEntities = Object.values(BookingEntity);
      const allActions = Object.values(PermissionAction);
      return allEntities.reduce(
        (acc, entity) => {
          acc[entity] = [...allActions];
          return acc;
        },
        {} as Record<BookingEntity, PermissionAction[]>
      );
    }

    const permissions = await this.permissionRepository.find({
      where: { bookingSystemId, userId, granted: true },
    });
    const result: Record<BookingEntity, PermissionAction[]> = {} as Record<
      BookingEntity,
      PermissionAction[]
    >;
    Object.values(BookingEntity).forEach((entity) => {
      result[entity] = [];
    });
    permissions.forEach((p) => {
      if (!result[p.entity]) result[p.entity] = [];
      result[p.entity].push(p.action);
    });
    return result;
  }

  async addUserToBookingSystem(
    bookingSystemId: string,
    userId: string,
    displayName?: string,
    permissions?: Record<BookingEntity, PermissionAction[]>
  ): Promise<BookingSystemUser> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) throw new NotFoundException("Система бронирования не найдена");
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Пользователь не найден");
    const existing = await this.bookingSystemUserRepository.findOne({
      where: { bookingSystemId, userId },
    });
    if (existing) {
      throw new BadRequestException(
        "Пользователь уже добавлен к этой системе бронирования"
      );
    }

    const bsUser = this.bookingSystemUserRepository.create({
      bookingSystemId,
      userId,
      displayName:
        displayName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.telegramId ||
        userId,
      permissions:
        permissions || ({} as Record<BookingEntity, PermissionAction[]>),
    });
    return this.bookingSystemUserRepository.save(bsUser);
  }

  async removeUserFromBookingSystem(
    bookingSystemId: string,
    userId: string
  ): Promise<void> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) throw new NotFoundException("Система бронирования не найдена");
    if (bs.ownerId === userId) {
      throw new BadRequestException(
        "Нельзя удалить владельца системы бронирования"
      );
    }
    await this.bookingSystemUserRepository.delete({ bookingSystemId, userId });
    await this.permissionRepository.delete({ bookingSystemId, userId });
  }

  async getBookingSystemUsers(
    bookingSystemId: string
  ): Promise<BookingSystemUser[]> {
    return this.bookingSystemUserRepository.find({
      where: { bookingSystemId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }

  async setBulkPermissions(
    bookingSystemId: string,
    userId: string,
    permissions: Record<BookingEntity, PermissionAction[]>,
    grantedByUserId: string
  ): Promise<void> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    const canManageUsers = await this.hasPermission(
      grantedByUserId,
      bookingSystemId,
      BookingEntity.BOOKING_SYSTEM_USERS,
      PermissionAction.UPDATE
    );
    if (grantedByUserId !== bs.ownerId && !canManageUsers) {
      throw new BadRequestException(
        "Недостаточно прав для управления пользователями"
      );
    }

    const existingPermissions = await this.permissionRepository.find({
      where: { bookingSystemId, userId },
    });
    const existingMap = new Map<string, BookingSystemUserPermission>();
    existingPermissions.forEach((p) => {
      existingMap.set(`${p.entity}_${p.action}`, p);
    });

    const toSave: BookingSystemUserPermission[] = [];
    Object.entries(permissions).forEach(([entity, actions]) => {
      (actions || []).forEach((action) => {
        const key = `${entity}_${action}`;
        let permission = existingMap.get(key);
        if (!permission) {
          permission = this.permissionRepository.create({
            bookingSystemId,
            userId,
            entity: entity as BookingEntity,
            action,
            granted: true,
            grantedByUserId,
          });
        } else {
          permission.granted = true;
          permission.grantedByUserId = grantedByUserId;
        }
        toSave.push(permission);
        existingMap.delete(key);
      });
    });

    await this.permissionRepository.save(toSave);
    if (existingMap.size > 0) {
      await this.permissionRepository.remove(Array.from(existingMap.values()));
    }
    await this.bookingSystemUserRepository.update(
      { bookingSystemId, userId },
      { permissions }
    );
  }
}
