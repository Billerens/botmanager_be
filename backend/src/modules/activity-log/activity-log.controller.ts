import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  getSchemaPath,
} from "@nestjs/swagger";

import { ActivityLogService } from "./activity-log.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import { ActivityLogResponseDto } from "./dto/activity-log-response.dto";

@ApiTags("Лог активности")
@Controller("activity-logs")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({ summary: "Получить лог активности текущего пользователя" })
  @ApiResponse({
    status: 200,
    description: "Лог активности получен",
    schema: {
      type: "array",
      items: {
        $ref: getSchemaPath(ActivityLogResponseDto),
      },
    },
  })
  async findAll(
    @Request() req,
    @Query("botId") botId?: string,
    @Query("type") type?: ActivityType,
    @Query("excludeTypes") excludeTypes?: string | string[],
    @Query("level") level?: ActivityLevel,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50
  ) {
    const userId = req.user.id;
    const excludeArr =
      excludeTypes === undefined
        ? undefined
        : Array.isArray(excludeTypes)
          ? excludeTypes.filter(Boolean)
          : excludeTypes.split(",").map((s) => s.trim()).filter(Boolean);
    return this.activityLogService.findAll(
      botId,
      userId,
      type,
      excludeArr as ActivityType[] | undefined,
      level,
      dateFrom,
      dateTo,
      page,
      limit
    );
  }

  @Get("stats")
  @ApiOperation({
    summary: "Получить статистику активности текущего пользователя",
  })
  @ApiResponse({ status: 200, description: "Статистика активности получена" })
  async getStats(@Request() req, @Query("botId") botId?: string) {
    // Автоматически фильтруем по userId текущего пользователя
    const userId = req.user.id;
    return this.activityLogService.getStats(botId, userId);
  }

  @Get("types")
  @ApiOperation({
    summary: "Получить список доступных типов активности",
  })
  @ApiResponse({
    status: 200,
    description: "Список типов активности получен",
    schema: {
      type: "array",
      items: {
        type: "string",
        enum: Object.values(ActivityType),
      },
    },
  })
  async getActivityTypes() {
    return Object.values(ActivityType);
  }
}
