import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityType, ActivityLevel } from '../../database/entities/activity-log.entity';

@ApiTags('Лог активности')
@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({ summary: 'Получить лог активности' })
  @ApiResponse({ status: 200, description: 'Лог активности получен' })
  async findAll(
    @Query('botId') botId?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: ActivityType,
    @Query('level') level?: ActivityLevel,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.activityLogService.findAll(botId, userId, type, level, page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Получить статистику активности' })
  @ApiResponse({ status: 200, description: 'Статистика активности получена' })
  async getStats(
    @Query('botId') botId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.activityLogService.getStats(botId, userId);
  }
}
