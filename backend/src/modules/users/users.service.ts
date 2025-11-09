import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { User, UserRole } from "../../database/entities/user.entity";
import { UpdateUserDto, UpdateUserRoleDto } from "./dto/user.dto";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private activityLogService: ActivityLogService
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      select: [
        "id",
        "telegramId",
        "telegramUsername",
        "firstName",
        "lastName",
        "role",
        "isActive",
        "createdAt",
        "lastLoginAt",
      ],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "telegramId",
        "telegramUsername",
        "firstName",
        "lastName",
        "role",
        "isActive",
        "createdAt",
        "lastLoginAt",
      ],
    });

    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { telegramId } });
  }

  async update(id: string, updateUserDto: UpdateUserDto, updatedByUserId?: string): Promise<User> {
    const user = await this.findOne(id);
    const oldData = {
      firstName: user.firstName,
      lastName: user.lastName,
      telegramUsername: user.telegramUsername,
    };

    // Обновляем только переданные поля
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    // Логируем обновление пользователя
    this.activityLogService
      .create({
        type: ActivityType.USER_UPDATED,
        level: ActivityLevel.INFO,
        message: `Обновлен пользователь ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.telegramId})`,
        userId: updatedByUserId || id,
        metadata: {
          targetUserId: id,
          targetUserTelegramId: updatedUser.telegramId,
          changes: updateUserDto,
          oldData,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления пользователя:", error);
      });

    return updatedUser;
  }

  async updateRole(
    id: string,
    updateUserRoleDto: UpdateUserRoleDto,
    updatedByUserId?: string
  ): Promise<User> {
    const user = await this.findOne(id);
    const oldRole = user.role;

    // Проверяем, что роль валидна
    if (!Object.values(UserRole).includes(updateUserRoleDto.role)) {
      throw new BadRequestException("Некорректная роль пользователя");
    }

    user.role = updateUserRoleDto.role;
    const updatedUser = await this.userRepository.save(user);

    // Логируем изменение роли
    this.activityLogService
      .create({
        type: ActivityType.USER_ROLE_CHANGED,
        level: ActivityLevel.WARNING,
        message: `Изменена роль пользователя ${updatedUser.firstName} ${updatedUser.lastName}: ${oldRole} → ${updateUserRoleDto.role}`,
        userId: updatedByUserId || id,
        metadata: {
          targetUserId: id,
          targetUserTelegramId: updatedUser.telegramId,
          oldRole,
          newRole: updateUserRoleDto.role,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования изменения роли:", error);
      });

    return updatedUser;
  }

  async toggleActive(id: string, updatedByUserId?: string): Promise<User> {
    const user = await this.findOne(id);
    const oldStatus = user.isActive;
    user.isActive = !user.isActive;
    const updatedUser = await this.userRepository.save(user);

    // Логируем переключение активности
    this.activityLogService
      .create({
        type: ActivityType.USER_UPDATED,
        level: oldStatus ? ActivityLevel.WARNING : ActivityLevel.SUCCESS,
        message: `Статус активности пользователя ${updatedUser.firstName} ${updatedUser.lastName} изменен: ${oldStatus ? "активен" : "неактивен"} → ${updatedUser.isActive ? "активен" : "неактивен"}`,
        userId: updatedByUserId || id,
        metadata: {
          targetUserId: id,
          targetUserTelegramId: updatedUser.telegramId,
          oldStatus,
          newStatus: updatedUser.isActive,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования переключения активности:", error);
      });

    return updatedUser;
  }

  async delete(id: string, deletedByUserId?: string): Promise<void> {
    const user = await this.findOne(id);
    const userData = {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    await this.userRepository.remove(user);

    // Логируем удаление пользователя
    this.activityLogService
      .create({
        type: ActivityType.USER_DELETED,
        level: ActivityLevel.WARNING,
        message: `Удален пользователь ${userData.firstName} ${userData.lastName} (${userData.telegramId})`,
        userId: deletedByUserId,
        metadata: {
          deletedUserId: userData.id,
          deletedUserTelegramId: userData.telegramId,
          deletedUserRole: userData.role,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования удаления пользователя:", error);
      });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
  }> {
    const users = await this.userRepository.find();

    const stats = {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      byRole: {
        [UserRole.OWNER]: 0,
        [UserRole.ADMIN]: 0,
        [UserRole.MANAGER]: 0,
      },
    };

    users.forEach((user) => {
      stats.byRole[user.role]++;
    });

    return stats;
  }

  async search(query: string): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder("user")
      .where("user.telegramId ILIKE :query", { query: `%${query}%` })
      .orWhere("user.telegramUsername ILIKE :query", { query: `%${query}%` })
      .orWhere("user.firstName ILIKE :query", { query: `%${query}%` })
      .orWhere("user.lastName ILIKE :query", { query: `%${query}%` })
      .select([
        "user.id",
        "user.telegramId",
        "user.telegramUsername",
        "user.firstName",
        "user.lastName",
        "user.role",
        "user.isActive",
      ])
      .getMany();
  }
}
