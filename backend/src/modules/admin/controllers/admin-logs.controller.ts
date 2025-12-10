import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { Request } from "express";

import { Admin, AdminRole } from "../../../database/entities/admin.entity";
import { AdminJwtGuard, AdminRoles } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";
import { AdminActionLogFilterDto } from "../dto/admin.dto";

interface AdminRequest extends Request {
  user: Admin;
}

@Controller("admin/logs")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminLogsController {
  constructor(private actionLogService: AdminActionLogService) {}

  @Get()
  async findAll(@Query() filter: AdminActionLogFilterDto) {
    const result = await this.actionLogService.findAll(filter);

    return {
      items: result.items,
      total: result.total,
      page: Number(filter.page || 1),
      limit: Number(filter.limit || 50),
      totalPages: Math.ceil(result.total / (filter.limit || 50)),
    };
  }

  @Get("recent")
  async getRecent(@Query("limit") limit = 20) {
    return this.actionLogService.getRecentActivity(Number(limit));
  }

  @Get("by-admin/:adminId")
  @AdminRoles(AdminRole.SUPERADMIN)
  async getByAdmin(
    @Query("limit") limit = 100
  ) {
    return this.actionLogService.findByAdmin(arguments[0], Number(limit));
  }

  @Get("by-entity")
  async getByEntity(
    @Query("entityType") entityType: string,
    @Query("entityId") entityId: string,
    @Query("limit") limit = 100
  ) {
    return this.actionLogService.findByEntity(
      entityType,
      entityId,
      Number(limit)
    );
  }

  @Get("stats")
  @AdminRoles(AdminRole.SUPERADMIN)
  async getStats(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.actionLogService.getStats(start, end);
  }
}

