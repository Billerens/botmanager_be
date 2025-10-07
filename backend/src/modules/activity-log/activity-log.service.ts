import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActivityLog, ActivityType, ActivityLevel } from '../../database/entities/activity-log.entity';
import { CreateActivityLogDto } from './dto/activity-log.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  async create(createActivityLogDto: CreateActivityLogDto): Promise<ActivityLog> {
    const activityLog = this.activityLogRepository.create(createActivityLogDto);
    return this.activityLogRepository.save(activityLog);
  }

  async findAll(
    botId?: string,
    userId?: string,
    type?: ActivityType,
    level?: ActivityLevel,
    page: number = 1,
    limit: number = 50,
  ): Promise<ActivityLog[]> {
    const query = this.activityLogRepository.createQueryBuilder('log');

    if (botId) {
      query.andWhere('log.botId = :botId', { botId });
    }

    if (userId) {
      query.andWhere('log.userId = :userId', { userId });
    }

    if (type) {
      query.andWhere('log.type = :type', { type });
    }

    if (level) {
      query.andWhere('log.level = :level', { level });
    }

    return query
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
  }

  async findOne(id: string): Promise<ActivityLog> {
    return this.activityLogRepository.findOne({ where: { id } });
  }

  async getStats(botId?: string, userId?: string): Promise<{
    total: number;
    byType: Record<ActivityType, number>;
    byLevel: Record<ActivityLevel, number>;
  }> {
    const query = this.activityLogRepository.createQueryBuilder('log');

    if (botId) {
      query.andWhere('log.botId = :botId', { botId });
    }

    if (userId) {
      query.andWhere('log.userId = :userId', { userId });
    }

    const logs = await query.getMany();

    const stats = {
      total: logs.length,
      byType: {} as Record<ActivityType, number>,
      byLevel: {} as Record<ActivityLevel, number>,
    };

    // Инициализируем счетчики
    Object.values(ActivityType).forEach(type => {
      stats.byType[type] = 0;
    });

    Object.values(ActivityLevel).forEach(level => {
      stats.byLevel[level] = 0;
    });

    // Подсчитываем
    logs.forEach(log => {
      stats.byType[log.type]++;
      stats.byLevel[log.level]++;
    });

    return stats;
  }

  async cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.activityLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
