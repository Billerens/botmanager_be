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
import { DashboardStatsResponseDto } from "./dto/analytics-response.dto";

@ApiTags("Аналитика")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
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
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }
}
