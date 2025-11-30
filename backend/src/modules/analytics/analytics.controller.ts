import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from "@nestjs/swagger";

import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BotPermissionGuard } from "../bots/guards/bot-permission.guard";
import { BotPermission } from "../bots/decorators/bot-permission.decorator";
import {
  BotEntity,
  PermissionAction,
} from "../../database/entities/bot-user-permission.entity";
import { DashboardStatsResponseDto } from "./dto/analytics-response.dto";

@ApiTags("Аналитика")
@Controller("analytics")
@UseGuards(JwtAuthGuard, BotPermissionGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Получить статистику дашборда" })
  @ApiResponse({
    status: 200,
    description: "Статистика получена",
    schema: {
      $ref: getSchemaPath(DashboardStatsResponseDto),
    },
  })
  @BotPermission(BotEntity.ANALYTICS, PermissionAction.READ)
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }
}
