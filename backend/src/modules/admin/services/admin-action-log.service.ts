import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, FindOptionsWhere } from "typeorm";
import {
  AdminActionLog,
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminActionLogFilterDto } from "../dto/admin.dto";

export interface CreateActionLogParams {
  adminId?: string;
  actionType: AdminActionType;
  level?: AdminActionLevel;
  description: string;
  entityType?: string;
  entityId?: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestUrl?: string;
  requestMethod?: string;
}

@Injectable()
export class AdminActionLogService {
  private readonly logger = new Logger(AdminActionLogService.name);

  constructor(
    @InjectRepository(AdminActionLog)
    private actionLogRepository: Repository<AdminActionLog>
  ) {}

  async create(params: CreateActionLogParams): Promise<AdminActionLog> {
    try {
      const log = this.actionLogRepository.create({
        adminId: params.adminId,
        actionType: params.actionType,
        level: params.level || AdminActionLevel.INFO,
        description: params.description,
        entityType: params.entityType,
        entityId: params.entityId,
        previousData: params.previousData,
        newData: params.newData,
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestUrl: params.requestUrl,
        requestMethod: params.requestMethod,
      });

      return await this.actionLogRepository.save(log);
    } catch (error) {
      this.logger.error("Ошибка создания лога действия админа:", error);
      throw error;
    }
  }

  async findAll(
    filter: AdminActionLogFilterDto
  ): Promise<{ items: AdminActionLog[]; total: number }> {
    const {
      adminId,
      actionType,
      entityType,
      entityId,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filter;

    const where: FindOptionsWhere<AdminActionLog> = {};

    if (adminId) {
      where.adminId = adminId;
    }

    if (actionType) {
      where.actionType = actionType as AdminActionType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (level) {
      where.level = level as AdminActionLevel;
    }

    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [items, total] = await this.actionLogRepository.findAndCount({
      where,
      relations: ["admin"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  async findByAdmin(
    adminId: string,
    limit = 100
  ): Promise<AdminActionLog[]> {
    return this.actionLogRepository.find({
      where: { adminId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit = 100
  ): Promise<AdminActionLog[]> {
    return this.actionLogRepository.find({
      where: { entityType, entityId },
      relations: ["admin"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async getRecentActivity(limit = 20): Promise<AdminActionLog[]> {
    return this.actionLogRepository.find({
      relations: ["admin"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async getStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActions: number;
    byType: Record<string, number>;
    byLevel: Record<string, number>;
    byAdmin: { adminId: string; count: number; admin?: Admin }[];
  }> {
    const logs = await this.actionLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ["admin"],
    });

    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    const byAdminMap: Record<string, { count: number; admin?: Admin }> = {};

    for (const log of logs) {
      // По типу
      byType[log.actionType] = (byType[log.actionType] || 0) + 1;

      // По уровню
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;

      // По админу
      if (log.adminId) {
        if (!byAdminMap[log.adminId]) {
          byAdminMap[log.adminId] = { count: 0, admin: log.admin };
        }
        byAdminMap[log.adminId].count++;
      }
    }

    const byAdmin = Object.entries(byAdminMap).map(([adminId, data]) => ({
      adminId,
      count: data.count,
      admin: data.admin,
    }));

    return {
      totalActions: logs.length,
      byType,
      byLevel,
      byAdmin,
    };
  }

  // Вспомогательный метод для логирования из контроллеров
  async logAction(
    admin: Admin,
    actionType: AdminActionType,
    description: string,
    options?: {
      level?: AdminActionLevel;
      entityType?: string;
      entityId?: string;
      previousData?: Record<string, any>;
      newData?: Record<string, any>;
      metadata?: Record<string, any>;
      request?: any;
    }
  ): Promise<AdminActionLog> {
    return this.create({
      adminId: admin.id,
      actionType,
      level: options?.level || AdminActionLevel.INFO,
      description,
      entityType: options?.entityType,
      entityId: options?.entityId,
      previousData: options?.previousData,
      newData: options?.newData,
      metadata: options?.metadata,
      ipAddress: options?.request?.ip,
      userAgent: options?.request?.headers?.["user-agent"],
      requestUrl: options?.request?.url,
      requestMethod: options?.request?.method,
    });
  }
}

