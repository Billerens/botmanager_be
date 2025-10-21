import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { User, UserRole } from "../../database/entities/user.entity";
import { UpdateUserDto, UpdateUserRoleDto } from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // Обновляем только переданные поля
    Object.assign(user, updateUserDto);

    return this.userRepository.save(user);
  }

  async updateRole(
    id: string,
    updateUserRoleDto: UpdateUserRoleDto
  ): Promise<User> {
    const user = await this.findOne(id);

    // Проверяем, что роль валидна
    if (!Object.values(UserRole).includes(updateUserRoleDto.role)) {
      throw new BadRequestException("Некорректная роль пользователя");
    }

    user.role = updateUserRoleDto.role;
    return this.userRepository.save(user);
  }

  async toggleActive(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = !user.isActive;
    return this.userRepository.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
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
