import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, FindOptionsWhere } from "typeorm";
import { Request } from "express";

import { User } from "../../../database/entities/user.entity";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";

interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/users")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminUsersController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll(
    @Req() req: AdminRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
    @Query("search") search?: string,
    @Query("isActive") isActive?: string
  ) {
    const where: FindOptionsWhere<User> = {};

    if (search) {
      where.telegramUsername = Like(`%${search}%`);
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const [items, total] = await this.userRepository.findAndCount({
      where,
      relations: ["bots", "subscriptions"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_LIST,
      `Просмотр списка пользователей (страница ${page})`,
      { request: req }
    );

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: AdminRequest) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ["bots", "leads", "subscriptions"],
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_VIEW,
      `Просмотр пользователя: ${user?.telegramId || id}`,
      { entityType: "user", entityId: id, request: req }
    );

    return user;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: Partial<User>,
    @Req() req: AdminRequest
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const previousData = { ...user };

    // Запрещаем менять критичные поля
    delete updateData.password;
    delete updateData.id;

    Object.assign(user, updateData);
    const savedUser = await this.userRepository.save(user);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_UPDATE,
      `Обновление пользователя: ${user.telegramId}`,
      {
        entityType: "user",
        entityId: id,
        previousData,
        newData: updateData,
        request: req,
      }
    );

    return savedUser;
  }

  @Put(":id/block")
  async blockUser(@Param("id") id: string, @Req() req: AdminRequest) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    user.isActive = false;
    await this.userRepository.save(user);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_BLOCK,
      `Блокировка пользователя: ${user.telegramId}`,
      {
        level: AdminActionLevel.WARNING,
        entityType: "user",
        entityId: id,
        request: req,
      }
    );

    return { message: "Пользователь заблокирован" };
  }

  @Put(":id/unblock")
  async unblockUser(@Param("id") id: string, @Req() req: AdminRequest) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    user.isActive = true;
    await this.userRepository.save(user);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_UNBLOCK,
      `Разблокировка пользователя: ${user.telegramId}`,
      { entityType: "user", entityId: id, request: req }
    );

    return { message: "Пользователь разблокирован" };
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() req: AdminRequest) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    const userData = { telegramId: user.telegramId, firstName: user.firstName };

    await this.userRepository.remove(user);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.USER_DELETE,
      `Удаление пользователя: ${userData.telegramId}`,
      {
        level: AdminActionLevel.CRITICAL,
        entityType: "user",
        entityId: id,
        previousData: userData,
        request: req,
      }
    );

    return { message: "Пользователь удален" };
  }

  // Статистика по пользователям
  @Get("stats/summary")
  async getStats() {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({ where: { isActive: true } });
    const verified = await this.userRepository.count({
      where: { isTelegramVerified: true },
    });

    // Новые пользователи за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsers = await this.userRepository
      .createQueryBuilder("user")
      .where("user.createdAt >= :date", { date: thirtyDaysAgo })
      .getCount();

    return {
      total,
      active,
      inactive: total - active,
      verified,
      unverified: total - verified,
      newUsersLast30Days: newUsers,
    };
  }
}

