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
import { Repository, Between, FindOptionsWhere } from "typeorm";
import { Request } from "express";

import { Lead } from "../../../database/entities/lead.entity";
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

@Controller("admin/leads")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminLeadsController {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    private actionLogService: AdminActionLogService
  ) {}

  @Get()
  async findAll(
    @Req() req: AdminRequest,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
    @Query("status") status?: string,
    @Query("botId") botId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const where: FindOptionsWhere<Lead> = {};

    if (status) {
      where.status = status as any;
    }

    if (botId) {
      where.botId = botId;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [items, total] = await this.leadRepository.findAndCount({
      where,
      relations: ["bot", "user"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.LEAD_LIST,
      `Просмотр списка лидов (страница ${page})`,
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
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: ["bot", "user"],
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.LEAD_VIEW,
      `Просмотр лида: ${id}`,
      { entityType: "lead", entityId: id, request: req }
    );

    return lead;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: Partial<Lead>,
    @Req() req: AdminRequest
  ) {
    const lead = await this.leadRepository.findOne({ where: { id } });
    if (!lead) {
      throw new Error("Лид не найден");
    }

    const previousData = { status: lead.status };

    Object.assign(lead, updateData);
    const savedLead = await this.leadRepository.save(lead);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.LEAD_UPDATE,
      `Обновление лида: ${id}`,
      {
        entityType: "lead",
        entityId: id,
        previousData,
        newData: updateData,
        request: req,
      }
    );

    return savedLead;
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() req: AdminRequest) {
    const lead = await this.leadRepository.findOne({ where: { id } });
    if (!lead) {
      throw new Error("Лид не найден");
    }

    await this.leadRepository.remove(lead);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.LEAD_DELETE,
      `Удаление лида: ${id}`,
      {
        level: AdminActionLevel.WARNING,
        entityType: "lead",
        entityId: id,
        request: req,
      }
    );

    return { message: "Лид удален" };
  }

  // Статистика по лидам
  @Get("stats/summary")
  async getStats() {
    const total = await this.leadRepository.count();

    // Группировка по статусам
    const byStatus = await this.leadRepository
      .createQueryBuilder("lead")
      .select("lead.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("lead.status")
      .getRawMany();

    // Новые лиды за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newLeads = await this.leadRepository
      .createQueryBuilder("lead")
      .where("lead.createdAt >= :date", { date: thirtyDaysAgo })
      .getCount();

    return {
      total,
      byStatus,
      newLeadsLast30Days: newLeads,
    };
  }
}

