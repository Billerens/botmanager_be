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

import { Bot } from "../../../database/entities/bot.entity";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
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

@Controller("admin/bots")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminBotsController {
  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(BotFlow)
    private botFlowRepository: Repository<BotFlow>,
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
    const where: FindOptionsWhere<Bot> = {};

    if (search) {
      where.name = Like(`%${search}%`);
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    const [items, total] = await this.botRepository.findAndCount({
      where,
      relations: ["owner", "flows"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_LIST,
      `Просмотр списка ботов (страница ${page})`,
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
    const bot = await this.botRepository.findOne({
      where: { id },
      relations: ["owner", "flows", "flows.nodes"],
    });

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_VIEW,
      `Просмотр бота: ${bot?.name || id}`,
      { entityType: "bot", entityId: id, request: req }
    );

    return bot;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: Partial<Bot>,
    @Req() req: AdminRequest
  ) {
    const bot = await this.botRepository.findOne({ where: { id } });
    if (!bot) {
      throw new Error("Бот не найден");
    }

    const previousData = { name: bot.name, isActive: bot.isActive };

    // Запрещаем менять критичные поля
    delete updateData.id;
    delete updateData.ownerId;

    Object.assign(bot, updateData);
    const savedBot = await this.botRepository.save(bot);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_UPDATE,
      `Обновление бота: ${bot.name}`,
      {
        entityType: "bot",
        entityId: id,
        previousData,
        newData: updateData,
        request: req,
      }
    );

    return savedBot;
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() req: AdminRequest) {
    const bot = await this.botRepository.findOne({
      where: { id },
      relations: ["owner"],
    });
    if (!bot) {
      throw new Error("Бот не найден");
    }

    const botData = { name: bot.name, ownerId: bot.ownerId };

    await this.botRepository.remove(bot);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_DELETE,
      `Удаление бота: ${botData.name}`,
      {
        level: AdminActionLevel.CRITICAL,
        entityType: "bot",
        entityId: id,
        previousData: botData,
        request: req,
      }
    );

    return { message: "Бот удален" };
  }

  // Управление flow ботов
  @Get(":id/flows")
  async getBotFlows(@Param("id") id: string) {
    return this.botFlowRepository.find({
      where: { botId: id },
      relations: ["nodes"],
      order: { createdAt: "DESC" },
    });
  }

  @Get(":botId/flows/:flowId")
  async getBotFlow(
    @Param("botId") botId: string,
    @Param("flowId") flowId: string
  ) {
    return this.botFlowRepository.findOne({
      where: { id: flowId, botId },
      relations: ["nodes"],
    });
  }

  @Put(":botId/flows/:flowId")
  async updateBotFlow(
    @Param("botId") botId: string,
    @Param("flowId") flowId: string,
    @Body() updateData: Partial<BotFlow>,
    @Req() req: AdminRequest
  ) {
    const flow = await this.botFlowRepository.findOne({
      where: { id: flowId, botId },
    });
    if (!flow) {
      throw new Error("Flow не найден");
    }

    const previousData = { name: flow.name };

    Object.assign(flow, updateData);
    const savedFlow = await this.botFlowRepository.save(flow);

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_FLOW_UPDATE,
      `Обновление flow: ${flow.name} (бот: ${botId})`,
      {
        entityType: "bot_flow",
        entityId: flowId,
        previousData,
        newData: updateData,
        metadata: { botId },
        request: req,
      }
    );

    return savedFlow;
  }

  // Статистика по ботам
  @Get("stats/summary")
  async getStats() {
    const total = await this.botRepository.count();
    const active = await this.botRepository.count({ where: { isActive: true } });

    // Боты с включенным магазином
    const withShop = await this.botRepository.count({
      where: { isShopEnabled: true },
    });

    // Боты с включенным бронированием
    const withBooking = await this.botRepository.count({
      where: { isBookingEnabled: true },
    });

    return {
      total,
      active,
      inactive: total - active,
      withShop,
      withBooking,
    };
  }
}

