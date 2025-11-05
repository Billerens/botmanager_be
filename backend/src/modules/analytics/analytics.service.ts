import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Bot, BotStatus } from '../../database/entities/bot.entity';
import { Message } from '../../database/entities/message.entity';
import { Lead } from '../../database/entities/lead.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
  ) {}

  async getDashboardStats() {
    // Общее количество ботов
    const totalBots = await this.botRepository.count();

    // Активные боты
    const activeBots = await this.botRepository.count({
      where: { status: BotStatus.ACTIVE },
    });

    // Общее количество сообщений
    const totalMessages = await this.messageRepository.count();

    // Общее количество лидов
    const totalLeads = await this.leadRepository.count();

    // Уникальные пользователи (из сообщений)
    const uniqueUsersFromMessages = await this.messageRepository
      .createQueryBuilder('message')
      .select('DISTINCT message.telegramUserId', 'telegramUserId')
      .where('message.telegramUserId IS NOT NULL')
      .getRawMany();

    // Уникальные пользователи (из лидов)
    const uniqueUsersFromLeads = await this.leadRepository
      .createQueryBuilder('lead')
      .select('DISTINCT lead.telegramUserId', 'telegramUserId')
      .where('lead.telegramUserId IS NOT NULL')
      .getRawMany();

    // Объединяем уникальные пользователи из обоих источников
    const allUniqueUserIds = new Set<string>();
    uniqueUsersFromMessages.forEach((u) => {
      if (u.telegramUserId) allUniqueUserIds.add(u.telegramUserId);
    });
    uniqueUsersFromLeads.forEach((u) => {
      if (u.telegramUserId) allUniqueUserIds.add(u.telegramUserId);
    });
    const totalUsers = allUniqueUserIds.size;

    // Новые пользователи за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsersFromMessages = await this.messageRepository
      .createQueryBuilder('message')
      .select('DISTINCT message.telegramUserId', 'telegramUserId')
      .where('message.telegramUserId IS NOT NULL')
      .andWhere('message.createdAt >= :date', { date: thirtyDaysAgo })
      .getRawMany();

    const newUsersFromLeads = await this.leadRepository
      .createQueryBuilder('lead')
      .select('DISTINCT lead.telegramUserId', 'telegramUserId')
      .where('lead.telegramUserId IS NOT NULL')
      .andWhere('lead.createdAt >= :date', { date: thirtyDaysAgo })
      .getRawMany();

    const newUserIds = new Set<string>();
    newUsersFromMessages.forEach((u) => {
      if (u.telegramUserId) newUserIds.add(u.telegramUserId);
    });
    newUsersFromLeads.forEach((u) => {
      if (u.telegramUserId) newUserIds.add(u.telegramUserId);
    });
    const newUsersLast30Days = newUserIds.size;

    // Сообщения за последние 7 дней
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const messagesLast7Days = await this.messageRepository.count({
      where: {
        createdAt: MoreThanOrEqual(sevenDaysAgo),
      },
    });

    // Лиды за последние 7 дней
    const leadsLast7Days = await this.leadRepository.count({
      where: {
        createdAt: MoreThanOrEqual(sevenDaysAgo),
      },
    });

    return {
      totalBots,
      totalUsers,
      totalMessages,
      totalLeads,
      activeBots,
      newUsersLast30Days,
      messagesLast7Days,
      leadsLast7Days,
    };
  }
}
