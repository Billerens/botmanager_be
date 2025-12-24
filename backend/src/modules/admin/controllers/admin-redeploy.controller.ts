import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Request } from "express";

import { Shop } from "../../../database/entities/shop.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { Admin } from "../../../database/entities/admin.entity";
import { AdminJwtGuard } from "../guards/admin-jwt.guard";
import { AdminRolesGuard } from "../guards/admin-roles.guard";
import { AdminActionLogService } from "../services/admin-action-log.service";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";
import { FrontendRedeployService } from "../../custom-domains/services/frontend-redeploy.service";
import { SubdomainService } from "../../custom-domains/services/subdomain.service";
import {
  SubdomainStatus,
  SubdomainType,
} from "../../custom-domains/enums/domain-status.enum";

interface AdminRequest extends Request {
  user: Admin;
}

interface SubdomainStatusItem {
  id: string;
  type: "shop" | "bot" | "page";
  name: string;
  slug: string | null;
  subdomainStatus: SubdomainStatus | null;
  subdomainUrl: string | null;
  subdomainError: string | null;
  subdomainActivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Controller("admin/redeploy")
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminRedeployController {
  constructor(
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(CustomPage)
    private customPageRepository: Repository<CustomPage>,
    @Inject(forwardRef(() => FrontendRedeployService))
    private frontendRedeployService: FrontendRedeployService,
    @Inject(forwardRef(() => SubdomainService))
    private subdomainService: SubdomainService,
    private actionLogService: AdminActionLogService
  ) {}

  /**
   * Получить статус планировщика редеплоя
   */
  @Get("status")
  async getRedeployStatus() {
    const schedulerStatus = this.frontendRedeployService.getSchedulerStatus();
    const redeployInfo = this.subdomainService.getRedeployInfo();

    return {
      scheduler: {
        isActive: schedulerStatus.isActive,
        frontendAppId: schedulerStatus.frontendAppId,
        frontendAppName: schedulerStatus.frontendAppName,
        lastRedeployAt: schedulerStatus.lastRedeployAt,
        nextRedeployAt: schedulerStatus.nextRedeployAt,
        secondsUntilNextRedeploy: schedulerStatus.secondsUntilNextRedeploy,
        intervalHours: schedulerStatus.intervalHours,
      },
      redeployInfo: {
        nextRedeployAt: redeployInfo.nextRedeployAt,
        secondsUntilRedeploy: redeployInfo.secondsUntilRedeploy,
        redeployIntervalHours: redeployInfo.redeployIntervalHours,
      },
    };
  }

  /**
   * Перепроверить и активировать планировщик
   */
  @Post("recheck")
  async recheckScheduler(@Req() req: AdminRequest) {
    const result = await this.frontendRedeployService.recheckAndActivate();

    // Логируем действие
    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SYSTEM_SETTINGS_UPDATE,
      `Перепроверка планировщика редеплоя: ${result.activated ? "активирован" : "не активирован"}. ${result.message}`,
      {
        level: AdminActionLevel.INFO,
        metadata: {
          activated: result.activated,
          appId: result.appId,
          appName: result.appName,
        },
        request: req,
      }
    );

    return result;
  }

  /**
   * Запустить принудительный редеплой фронтенда
   */
  @Post("trigger")
  async triggerRedeploy(@Req() req: AdminRequest) {
    const result = await this.frontendRedeployService.triggerManualRedeploy();

    // Логируем действие
    await this.actionLogService.logAction(
      req.user,
      AdminActionType.SYSTEM_SETTINGS_UPDATE,
      `Принудительный редеплой фронтенда: ${result.success ? "успешно" : "ошибка"}. ${result.message}`,
      {
        level: AdminActionLevel.INFO,
        metadata: {
          success: result.success,
          appId: result.appId,
          appName: result.appName,
          error: result.message,
        },
        request: req,
      }
    );

    return result;
  }

  /**
   * Получить список всех субдоменов со статусами
   */
  @Get("subdomains")
  async getSubdomainsStatus() {
    // Получаем все субдомены из разных источников
    const [shops, bots, pages] = await Promise.all([
      this.shopRepository.find({
        where: {
          subdomainStatus: In([
            SubdomainStatus.PENDING,
            SubdomainStatus.DNS_CREATING,
            SubdomainStatus.ACTIVATING,
            SubdomainStatus.ACTIVE,
            SubdomainStatus.ERROR,
            SubdomainStatus.REMOVING,
          ]),
        },
        select: [
          "id",
          "name",
          "slug",
          "subdomainStatus",
          "subdomainUrl",
          "subdomainError",
          "subdomainActivatedAt",
          "createdAt",
          "updatedAt",
        ],
        order: { createdAt: "DESC" },
      }),
      this.botRepository.find({
        where: {
          subdomainStatus: In([
            SubdomainStatus.PENDING,
            SubdomainStatus.DNS_CREATING,
            SubdomainStatus.ACTIVATING,
            SubdomainStatus.ACTIVE,
            SubdomainStatus.ERROR,
            SubdomainStatus.REMOVING,
          ]),
        },
        select: [
          "id",
          "name",
          "slug",
          "subdomainStatus",
          "subdomainUrl",
          "subdomainError",
          "subdomainActivatedAt",
          "createdAt",
          "updatedAt",
        ],
        order: { createdAt: "DESC" },
      }),
      this.customPageRepository.find({
        where: {
          subdomainStatus: In([
            SubdomainStatus.PENDING,
            SubdomainStatus.DNS_CREATING,
            SubdomainStatus.ACTIVATING,
            SubdomainStatus.ACTIVE,
            SubdomainStatus.ERROR,
            SubdomainStatus.REMOVING,
          ]),
        },
        select: [
          "id",
          "title",
          "slug",
          "subdomainStatus",
          "subdomainUrl",
          "subdomainError",
          "subdomainActivatedAt",
          "createdAt",
          "updatedAt",
        ],
        order: { createdAt: "DESC" },
      }),
    ]);

    // Объединяем все субдомены в один массив
    const subdomains: SubdomainStatusItem[] = [
      ...shops.map((shop) => ({
        id: shop.id,
        type: "shop" as const,
        name: shop.name,
        slug: shop.slug,
        subdomainStatus: shop.subdomainStatus,
        subdomainUrl: shop.subdomainUrl,
        subdomainError: shop.subdomainError,
        subdomainActivatedAt: shop.subdomainActivatedAt,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      })),
      ...bots.map((bot) => ({
        id: bot.id,
        type: "bot" as const,
        name: bot.name,
        slug: bot.slug,
        subdomainStatus: bot.subdomainStatus,
        subdomainUrl: bot.subdomainUrl,
        subdomainError: bot.subdomainError,
        subdomainActivatedAt: bot.subdomainActivatedAt,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      })),
      ...pages.map((page) => ({
        id: page.id,
        type: "page" as const,
        name: page.title,
        slug: page.slug,
        subdomainStatus: page.subdomainStatus,
        subdomainUrl: page.subdomainUrl,
        subdomainError: page.subdomainError,
        subdomainActivatedAt: page.subdomainActivatedAt,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      })),
    ];

    // Добавляем информацию о редеплое для каждого субдомена
    const redeployInfo = this.subdomainService.getRedeployInfo();
    const subdomainsWithRedeployInfo = subdomains.map((subdomain) => ({
      ...subdomain,
      redeployInfo: {
        nextRedeployAt: redeployInfo.nextRedeployAt,
        secondsUntilRedeploy: redeployInfo.secondsUntilRedeploy,
        redeployIntervalHours: redeployInfo.redeployIntervalHours,
      },
    }));

    return {
      subdomains: subdomainsWithRedeployInfo,
      total: subdomains.length,
      byStatus: {
        active: subdomains.filter(
          (s) => s.subdomainStatus === SubdomainStatus.ACTIVE
        ).length,
        pending: subdomains.filter((s) =>
          [
            SubdomainStatus.PENDING,
            SubdomainStatus.DNS_CREATING,
            SubdomainStatus.ACTIVATING,
          ].includes(s.subdomainStatus as SubdomainStatus)
        ).length,
        error: subdomains.filter(
          (s) => s.subdomainStatus === SubdomainStatus.ERROR
        ).length,
        removing: subdomains.filter(
          (s) => s.subdomainStatus === SubdomainStatus.REMOVING
        ).length,
      },
    };
  }
}
