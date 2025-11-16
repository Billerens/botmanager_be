import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  GroupSession,
  GroupSessionStatus,
} from "../../database/entities/group-session.entity";
import { UserSession } from "../../database/entities/user-session.entity";
import { SessionStorageService } from "./session-storage.service";
import { CustomLoggerService } from "../../common/logger.service";
import { RedisService } from "../websocket/services/redis.service";

export const GROUP_LIMITS = {
  MAX_PARTICIPANTS_PER_GROUP: 10000,
  MAX_ACTIVE_GROUPS_PER_BOT: 1000,
  MAX_GROUPS_PER_USER_PER_BOT: 1,
  AUTO_ARCHIVE_DAYS: 7,
};

@Injectable()
export class GroupSessionService {
  private readonly logger = new Logger(GroupSessionService.name);

  constructor(
    @InjectRepository(GroupSession)
    private readonly groupSessionRepository: Repository<GroupSession>,
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    private readonly sessionStorageService: SessionStorageService,
    private readonly customLogger: CustomLoggerService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Создать новую групповую сессию
   */
  async create(
    botId: string,
    flowId: string,
    creatorUserId: string,
    metadata?: Record<string, any>
  ): Promise<GroupSession> {
    // Проверяем лимит активных групп для бота
    const activeCount = await this.countActiveGroups(botId);
    if (activeCount >= GROUP_LIMITS.MAX_ACTIVE_GROUPS_PER_BOT) {
      throw new Error(
        `Достигнут лимит активных групп для бота (${GROUP_LIMITS.MAX_ACTIVE_GROUPS_PER_BOT})`
      );
    }

    const group = new GroupSession();
    group.botId = botId;
    group.flowId = flowId;
    group.participantIds = [creatorUserId];
    group.sharedVariables = {};
    group.status = GroupSessionStatus.ACTIVE;
    group.metadata = {
      createdBy: creatorUserId,
      maxSize: metadata?.maxSize || GROUP_LIMITS.MAX_PARTICIPANTS_PER_GROUP,
      ...metadata,
    };

    const savedGroup = await this.groupSessionRepository.save(group);

    // Сохраняем в Redis для быстрого доступа
    await this.saveToRedis(savedGroup);

    this.customLogger.log(
      `Создана групповая сессия ${savedGroup.id} для бота ${botId}`
    );

    return savedGroup;
  }

  /**
   * Найти группу по ID
   */
  async findById(id: string): Promise<GroupSession | null> {
    // Сначала пытаемся получить из Redis
    const cached = await this.getFromRedis(id);
    if (cached) {
      return cached;
    }

    // Если нет в Redis, получаем из БД
    const group = await this.groupSessionRepository.findOne({
      where: { id },
    });

    if (group) {
      // Кэшируем в Redis
      await this.saveToRedis(group);
    }

    return group;
  }

  /**
   * Добавить участника в группу
   */
  async addParticipant(groupId: string, userId: string): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      throw new NotFoundException(`Группа ${groupId} не найдена`);
    }

    if (!group.isActive) {
      throw new Error("Группа не активна");
    }

    if (group.isFull) {
      throw new Error(
        `Группа полна (${group.participantCount}/${group.metadata?.maxSize})`
      );
    }

    if (group.hasParticipant(userId)) {
      this.logger.warn(
        `Пользователь ${userId} уже в группе ${groupId}, пропускаем`
      );
      return;
    }

    // Проверяем, не состоит ли пользователь уже в другой активной группе этого бота
    const userSession = await this.sessionStorageService.getSession(
      group.botId,
      userId
    );

    if (userSession?.lobbyData?.groupSessionId) {
      // Автоматически покидаем предыдущую группу
      await this.removeParticipant(
        userSession.lobbyData.groupSessionId,
        userId
      );
    }

    // Добавляем участника
    group.participantIds.push(userId);
    await this.groupSessionRepository.save(group);

    // Обновляем в Redis
    await this.saveToRedis(group);

    // Добавляем в Redis Set для быстрого доступа
    await this.redisService.sadd(`group:${groupId}:participants`, userId);

    // Обновляем сессию пользователя
    if (userSession) {
      userSession.lobbyData = {
        groupSessionId: groupId,
        joinedAt: new Date(),
        participantVariables: userSession.lobbyData?.participantVariables || {},
      };
      await this.sessionStorageService.saveSession(userSession, true);
    }

    this.customLogger.log(
      `Пользователь ${userId} добавлен в группу ${groupId}`
    );
  }

  /**
   * Удалить участника из группы
   */
  async removeParticipant(groupId: string, userId: string): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      this.logger.warn(`Группа ${groupId} не найдена при удалении участника`);
      return;
    }

    const index = group.participantIds.indexOf(userId);
    if (index === -1) {
      this.logger.warn(
        `Пользователь ${userId} не найден в группе ${groupId}`
      );
      return;
    }

    // Удаляем участника
    group.participantIds.splice(index, 1);
    await this.groupSessionRepository.save(group);

    // Обновляем в Redis
    await this.saveToRedis(group);
    await this.redisService.srem(`group:${groupId}:participants`, userId);

    // Очищаем lobbyData в сессии пользователя
    const userSession = await this.sessionStorageService.getSession(
      group.botId,
      userId
    );
    if (userSession?.lobbyData?.groupSessionId === groupId) {
      userSession.lobbyData = undefined;
      await this.sessionStorageService.saveSession(userSession, true);
    }

    this.customLogger.log(
      `Пользователь ${userId} удален из группы ${groupId}`
    );

    // Если группа пустая, архивируем её
    if (group.participantIds.length === 0) {
      await this.archive(groupId);
    }
  }

  /**
   * Обновить общие переменные группы
   */
  async updateSharedVariables(
    groupId: string,
    variables: Record<string, any>
  ): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      throw new NotFoundException(`Группа ${groupId} не найдена`);
    }

    group.sharedVariables = {
      ...group.sharedVariables,
      ...variables,
    };

    await this.groupSessionRepository.save(group);
    await this.saveToRedis(group);

    this.customLogger.log(`Обновлены переменные группы ${groupId}`);
  }

  /**
   * Получить сессии всех участников группы
   */
  async getParticipantSessions(groupId: string): Promise<UserSession[]> {
    const group = await this.findById(groupId);

    if (!group) {
      return [];
    }

    // Получаем сессии из БД (они могут быть в Redis или БД)
    const sessions = await this.userSessionRepository.find({
      where: {
        botId: group.botId,
        userId: { $in: group.participantIds } as any,
      },
    });

    return sessions;
  }

  /**
   * Получить ID участников группы
   */
  async getParticipantIds(groupId: string): Promise<string[]> {
    // Сначала пытаемся получить из Redis Set (быстро)
    const cached = await this.redisService.smembers(
      `group:${groupId}:participants`
    );

    if (cached && cached.length > 0) {
      return cached;
    }

    // Если нет в Redis, получаем из БД
    const group = await this.findById(groupId);
    return group?.participantIds || [];
  }

  /**
   * Получить все активные группы бота
   */
  async getActiveGroupsForBot(botId: string): Promise<GroupSession[]> {
    return await this.groupSessionRepository.find({
      where: {
        botId,
        status: GroupSessionStatus.ACTIVE,
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Получить активную группу пользователя
   */
  async getUserActiveGroup(
    botId: string,
    userId: string
  ): Promise<GroupSession | null> {
    const session = await this.sessionStorageService.getSession(botId, userId);

    if (!session?.lobbyData?.groupSessionId) {
      return null;
    }

    return await this.findById(session.lobbyData.groupSessionId);
  }

  /**
   * Обновить позицию группы в flow
   */
  async updateCurrentNode(groupId: string, nodeId: string): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      throw new NotFoundException(`Группа ${groupId} не найдена`);
    }

    group.currentNodeId = nodeId;
    await this.groupSessionRepository.save(group);
    await this.saveToRedis(group);
  }

  /**
   * Завершить группу
   */
  async complete(groupId: string): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      return;
    }

    group.status = GroupSessionStatus.COMPLETED;
    group.completedAt = new Date();
    await this.groupSessionRepository.save(group);
    await this.saveToRedis(group);

    this.customLogger.log(`Группа ${groupId} завершена`);
  }

  /**
   * Архивировать группу
   */
  async archive(groupId: string): Promise<void> {
    const group = await this.findById(groupId);

    if (!group) {
      return;
    }

    group.status = GroupSessionStatus.ARCHIVED;
    await this.groupSessionRepository.save(group);

    // Удаляем из Redis
    await this.deleteFromRedis(groupId);
    await this.redisService.del(`group:${groupId}:participants`);

    this.customLogger.log(`Группа ${groupId} архивирована`);
  }

  /**
   * Подсчитать количество активных групп для бота
   */
  async countActiveGroups(botId: string): Promise<number> {
    return await this.groupSessionRepository.count({
      where: {
        botId,
        status: GroupSessionStatus.ACTIVE,
      },
    });
  }

  /**
   * Cron job: Автоматическая архивация неактивных групп
   * Запускается каждый день в 3:00 ночи
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async archiveInactiveGroups(): Promise<void> {
    this.logger.log("Запуск автоархивации неактивных групп...");

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - GROUP_LIMITS.AUTO_ARCHIVE_DAYS);

    try {
      const result = await this.groupSessionRepository.update(
        {
          status: GroupSessionStatus.ACTIVE,
          updatedAt: LessThan(archiveDate),
        },
        {
          status: GroupSessionStatus.ARCHIVED,
        }
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(`Архивировано ${result.affected} неактивных групп`);
      }
    } catch (error) {
      this.logger.error("Ошибка автоархивации групп:", error);
    }
  }

  /**
   * Получить статистику по группам бота
   */
  async getBotGroupStats(botId: string) {
    const allGroups = await this.groupSessionRepository.find({
      where: { botId },
    });

    const activeGroups = allGroups.filter((g) => g.isActive);
    const totalParticipants = allGroups.reduce(
      (sum, g) => sum + g.participantCount,
      0
    );

    return {
      totalGroups: allGroups.length,
      activeGroups: activeGroups.length,
      completedGroups: allGroups.filter((g) => g.isCompleted).length,
      archivedGroups: allGroups.filter((g) => g.isArchived).length,
      totalParticipants,
      averageGroupSize:
        allGroups.length > 0 ? totalParticipants / allGroups.length : 0,
      largestGroup: Math.max(...allGroups.map((g) => g.participantCount), 0),
    };
  }

  // Приватные методы для работы с Redis

  private async saveToRedis(group: GroupSession): Promise<void> {
    const key = `group:${group.id}`;
    const serialized = JSON.stringify(group);
    await this.redisService.set(key, serialized, { EX: 3600 }); // TTL 1 час
  }

  private async getFromRedis(groupId: string): Promise<GroupSession | null> {
    const key = `group:${groupId}`;
    const data = await this.redisService.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Ошибка парсинга данных группы из Redis:`, error);
      return null;
    }
  }

  private async deleteFromRedis(groupId: string): Promise<void> {
    await this.redisService.del(`group:${groupId}`);
  }
}

