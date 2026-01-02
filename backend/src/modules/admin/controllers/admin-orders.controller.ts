import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, FindOptionsWhere } from "typeorm";
import { Request } from "express";

import { Order } from "../../../database/entities/order.entity";
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

@Controller("admin/orders")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminOrdersController {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll(
    @Req() req: AdminRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
    @Query("status") status?: string,
    @Query("shopId") shopId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const where: FindOptionsWhere<Order> = {};

    if (status) {
      where.status = status as any;
    }

    if (shopId) {
      where.shopId = shopId;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [items, total] = await this.orderRepository.findAndCount({
      where,
      relations: ["shop"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.ORDER_LIST,
      `Просмотр списка заказов (страница ${page})`,
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
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ["shop"],
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.ORDER_VIEW,
      `Просмотр заказа: ${id}`,
      { entityType: "order", entityId: id, request: req }
    );

    return order;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: Partial<Order>,
    @Req() req: AdminRequest
  ) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new Error("Заказ не найден");
    }

    const previousData = { status: order.status };

    Object.assign(order, updateData);
    const savedOrder = await this.orderRepository.save(order);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.ORDER_UPDATE,
      `Обновление заказа: ${id}`,
      {
        entityType: "order",
        entityId: id,
        previousData,
        newData: updateData,
        request: req,
      }
    );

    return savedOrder;
  }

  @Put(":id/cancel")
  async cancel(@Param("id") id: string, @Req() req: AdminRequest) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new Error("Заказ не найден");
    }

    const previousStatus = order.status;
    order.status = "cancelled" as any;
    await this.orderRepository.save(order);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.ORDER_CANCEL,
      `Отмена заказа: ${id}`,
      {
        level: AdminActionLevel.WARNING,
        entityType: "order",
        entityId: id,
        previousData: { status: previousStatus },
        newData: { status: "cancelled" },
        request: req,
      }
    );

    return { message: "Заказ отменен" };
  }

  // Статистика по заказам
  @Get("stats/summary")
  async getStats(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const queryBuilder = this.orderRepository.createQueryBuilder("ord");

    if (startDate && endDate) {
      queryBuilder.where("ord.createdAt BETWEEN :start AND :end", {
        start: new Date(startDate),
        end: new Date(endDate),
      });
    }

    const total = await queryBuilder.getCount();

    // Группировка по статусам
    const byStatus = await this.orderRepository
      .createQueryBuilder("ord")
      .select("ord.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(ord.totalAmount)", "totalAmount")
      .groupBy("ord.status")
      .getRawMany();

    // Сумма всех заказов
    const totalRevenue = await this.orderRepository
      .createQueryBuilder("ord")
      .select("SUM(ord.totalAmount)", "total")
      .where("ord.status != :status", { status: "cancelled" })
      .getRawOne();

    return {
      total,
      byStatus,
      totalRevenue: totalRevenue?.total || 0,
    };
  }
}

