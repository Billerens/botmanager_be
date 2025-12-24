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
import { Repository, Like, In } from "typeorm";
import { Request } from "express";

import { Bot, BotStatus } from "../../../database/entities/bot.entity";
import { BotFlow } from "../../../database/entities/bot-flow.entity";
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

@Controller("admin/bots")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminBotsController {
  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(BotFlow)
    private botFlowRepository: Repository<BotFlow>,
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
    @Query("status") status?: string,
    @Query("ownerId") ownerId?: string
  ) {
    const queryBuilder = this.botRepository
      .createQueryBuilder("bot")
      .leftJoinAndSelect("bot.owner", "owner")
      .leftJoinAndSelect("bot.flows", "flows");

    if (search) {
      queryBuilder.andWhere("bot.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (status) {
      queryBuilder.andWhere("bot.status = :status", { status });
    }

    if (ownerId) {
      queryBuilder.andWhere("bot.ownerId = :ownerId", { ownerId });
    }

    queryBuilder
      .orderBy("bot.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // Загружаем привязанные магазины для всех ботов одним запросом
    const botIds = items.map((bot) => bot.id);
    const shops = botIds.length > 0
      ? await this.shopRepository.find({
          where: { botId: In(botIds) },
          select: ["id", "name", "botId"],
        })
      : [];

    // Создаем мапу магазинов по botId
    const shopMap = new Map(shops.map((shop) => [shop.botId, shop]));

    // Добавляем магазины к ботам
    const itemsWithShops = items.map((bot) => ({
      ...bot,
      shop: shopMap.get(bot.id) || null,
    }));

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_LIST,
      `Просмотр списка ботов (страница ${page})`,
      { request: req }
    );

    return {
      items: itemsWithShops,
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

    // Загружаем привязанный магазин
    const shop = bot
      ? await this.shopRepository.findOne({
          where: { botId: bot.id },
          select: ["id", "name", "botId"],
        })
      : null;

    const botWithShop = bot ? { ...bot, shop: shop || null } : bot;

    await this.actionLogService.logAction(
      req.user,
      AdminActionType.BOT_VIEW,
      `Просмотр бота: ${bot?.name || id}`,
      { entityType: "bot", entityId: id, request: req }
    );

    return botWithShop;
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

    const previousData = { name: bot.name, status: bot.status };

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
    const active = await this.botRepository.count({
      where: { status: BotStatus.ACTIVE },
    });

    // Боты с включенным бронированием
    const withBooking = await this.botRepository.count({
      where: { isBookingEnabled: true },
    });

    return {
      total,
      active,
      inactive: total - active,
      withBooking,
    };
  }
}
