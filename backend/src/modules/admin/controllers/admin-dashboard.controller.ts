import { Controller, Get, UseGuards, Req } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { Request } from "express";

import { User } from "../../../database/entities/user.entity";
import { Bot, BotStatus } from "../../../database/entities/bot.entity";
import { Shop } from "../../../database/entities/shop.entity";
import { Order } from "../../../database/entities/order.entity";
import { Lead } from "../../../database/entities/lead.entity";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";

interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/dashboard")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminDashboardController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    private actionLogService: AdminActionLogService
  ) {}

  @Get("stats")
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalBots,
      activeBots,
      totalShops,
      shopsWithBot,
      totalOrders,
      todayOrders,
      totalLeads,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.botRepository.count(),
      this.botRepository.count({ where: { status: BotStatus.ACTIVE } }),
      this.shopRepository.count(),
      this.shopRepository
        .createQueryBuilder("shop")
        .where("shop.botId IS NOT NULL")
        .getCount(),
      this.orderRepository.count(),
      this.orderRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.leadRepository.count(),
    ]);

    // Выручка за сегодня
    const todayRevenue = await this.orderRepository
      .createQueryBuilder("ord")
      .select("SUM(ord.totalAmount)", "total")
      .where("ord.createdAt >= :today", { today })
      .andWhere("ord.status != :status", { status: "cancelled" })
      .getRawOne();

    // Выручка за всё время
    const totalRevenue = await this.orderRepository
      .createQueryBuilder("ord")
      .select("SUM(ord.totalAmount)", "total")
      .where("ord.status != :status", { status: "cancelled" })
      .getRawOne();

    // Недавняя активность админов
    const recentActivity = await this.actionLogService.getRecentActivity(10);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      bots: {
        total: totalBots,
        active: activeBots,
        inactive: totalBots - activeBots,
      },
      shops: {
        total: totalShops,
        withBot: shopsWithBot,
        withoutBot: totalShops - shopsWithBot,
      },
      orders: {
        total: totalOrders,
        today: todayOrders,
      },
      leads: {
        total: totalLeads,
      },
      revenue: {
        today: todayRevenue?.total || 0,
        total: totalRevenue?.total || 0,
      },
      recentActivity,
    };
  }

  @Get("charts/users")
  async getUsersChart() {
    // Количество пользователей за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await this.userRepository
      .createQueryBuilder("user")
      .select("DATE(user.createdAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where("user.createdAt >= :date", { date: thirtyDaysAgo })
      .groupBy("DATE(user.createdAt)")
      .orderBy("DATE(user.createdAt)", "ASC")
      .getRawMany();

    return data;
  }

  @Get("charts/orders")
  async getOrdersChart() {
    // Заказы за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await this.orderRepository
      .createQueryBuilder("ord")
      .select("DATE(ord.createdAt)", "date")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(ord.totalAmount)", "revenue")
      .where("ord.createdAt >= :date", { date: thirtyDaysAgo })
      .groupBy("DATE(ord.createdAt)")
      .orderBy("DATE(ord.createdAt)", "ASC")
      .getRawMany();

    return data;
  }

  @Get("charts/revenue")
  async getRevenueChart() {
    // Выручка по месяцам за последний год
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const data = await this.orderRepository
      .createQueryBuilder("ord")
      .select("TO_CHAR(ord.createdAt, 'YYYY-MM')", "month")
      .addSelect("SUM(ord.totalAmount)", "revenue")
      .addSelect("COUNT(*)", "orders")
      .where("ord.createdAt >= :date", { date: oneYearAgo })
      .andWhere("ord.status != :status", { status: "cancelled" })
      .groupBy("TO_CHAR(ord.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(ord.createdAt, 'YYYY-MM')", "ASC")
      .getRawMany();

    return data;
  }
}
