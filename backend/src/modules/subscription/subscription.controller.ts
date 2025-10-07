import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionPlan } from '../../database/entities/subscription.entity';

@ApiTags('Подписки')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить мою подписку' })
  @ApiResponse({ status: 200, description: 'Подписка получена' })
  async getMySubscription(@Request() req) {
    return this.subscriptionService.findByUserId(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать подписку' })
  @ApiResponse({ status: 201, description: 'Подписка создана' })
  async create(@Request() req, @Body() body: { plan: SubscriptionPlan }) {
    return this.subscriptionService.create(req.user.id, body.plan);
  }
}
