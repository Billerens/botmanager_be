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

import { Shop } from "../../../database/entities/shop.entity";
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

@Controller("admin/shops")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminShopsController {
  constructor(
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    private actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll(
    @Req() req: AdminRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
    @Query("search") search?: string,
    @Query("isActive") isActive?: string,
    @Query("ownerId") ownerId?: string
  ) {
    const where: FindOptionsWhere<Shop> = {};

    if (search) {
      where.name = Like(`%${search}%`);
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    const [items, total] = await this.shopRepository.findAndCount({
      where,
      relations: ["owner", "bot"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SHOP_LIST,
      `Просмотр списка магазинов (страница ${page})`,
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
    const shop = await this.shopRepository.findOne({
      where: { id },
      relations: ["owner", "bot", "products", "categories", "orders"],
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SHOP_VIEW,
      `Просмотр магазина: ${shop?.name || id}`,
      { entityType: "shop", entityId: id, request: req }
    );

    return shop;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: Partial<Shop>,
    @Req() req: AdminRequest
  ) {
    const shop = await this.shopRepository.findOne({ where: { id } });
    if (!shop) {
      throw new Error("Магазин не найден");
    }

    const previousData = { name: shop.name, isActive: shop.isActive };

    // Запрещаем менять критичные поля
    delete updateData.id;
    delete updateData.ownerId;

    Object.assign(shop, updateData);
    const savedShop = await this.shopRepository.save(shop);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SHOP_UPDATE,
      `Обновление магазина: ${shop.name}`,
      {
        entityType: "shop",
        entityId: id,
        previousData,
        newData: updateData,
        request: req,
      }
    );

    return savedShop;
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() req: AdminRequest) {
    const shop = await this.shopRepository.findOne({
      where: { id },
      relations: ["owner"],
    });
    if (!shop) {
      throw new Error("Магазин не найден");
    }

    const shopData = { name: shop.name, ownerId: shop.ownerId };

    await this.shopRepository.remove(shop);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SHOP_DELETE,
      `Удаление магазина: ${shopData.name}`,
      {
        level: AdminActionLevel.CRITICAL,
        entityType: "shop",
        entityId: id,
        previousData: shopData,
        request: req,
      }
    );

    return { message: "Магазин удален" };
  }

  // Статистика по магазинам
  @Get("stats/summary")
  async getStats() {
    const total = await this.shopRepository.count();
    const active = await this.shopRepository.count({ where: { isActive: true } });

    return {
      total,
      active,
      inactive: total - active,
    };
  }
}

