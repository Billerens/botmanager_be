import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  // Заглушка для аналитики
  async getDashboardStats() {
    return {
      totalBots: 0,
      totalUsers: 0,
      totalMessages: 0,
      totalLeads: 0,
    };
  }
}
