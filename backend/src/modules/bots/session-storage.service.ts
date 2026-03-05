import { Injectable, Inject, Logger, OnModuleDestroy, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RedisService } from "../websocket/services/redis.service";
import {
  UserSession,
  SessionStatus,
  SessionType,
} from "../../database/entities/user-session.entity";
import { CustomLoggerService } from "../../common/logger.service";

export interface UserSessionData {
  userId: string;
  chatId: string;
  botId: string;
  currentNodeId?: string;
  variables: Record<string, any>;
  lastActivity: Date;
  locationRequest?: {
    nodeId: string;
    timestamp: Date;
    timeout: number;
  };
  sessionType?: SessionType;
  lobbyData?: {
    lobbyId?: string;
    groupSessionId?: string;
    role?: string;
    joinedAt?: Date;
    participantVariables?: Record<string, any>;
  };
  lastSavedToDb?: Date;
}

@Injectable()
export class SessionStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStorageService.name);

  // TTL в секундах (2 часа)
  private readonly SESSION_TTL = 2 * 60 * 60;

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    private readonly redisService: RedisService,
    private readonly customLogger: CustomLoggerService
  ) {}

  async onModuleDestroy() {
    // Очистка при завершении работы
    this.logger.log("SessionStorageService завершает работу");
  }

  /**
   * Получить сессию пользователя
   */
  async getSession(
    botId: string,
    userId: string
  ): Promise<UserSessionData | null> {
    const sessionKey = `${botId}-${userId}`;

    try {
      // Сначала пытаемся получить из Redis
      const redisKey = `session:${sessionKey}`;
      const redisData = await this.redisService.get(redisKey);

      if (redisData) {
        const session = JSON.parse(redisData);
        this.logger.debug(`Сессия ${sessionKey} найдена в Redis`);
        return session;
      }

      // Если в Redis нет, ищем в БД
      const dbSession = await this.sessionRepository.findOne({
        where: { sessionKey, status: SessionStatus.ACTIVE },
      });

      if (dbSession) {
        this.logger.debug(
          `Сессия ${sessionKey} найдена в БД, восстанавливаем в Redis`
        );
        const sessionData = this.entityToData(dbSession);

        // Восстанавливаем в Redis
        await this.saveToRedis(sessionKey, sessionData);

        return sessionData;
      }

      this.logger.debug(`Сессия ${sessionKey} не найдена`);
      return null;
    } catch (error) {
      this.logger.error(`Ошибка получения сессии ${sessionKey}:`, error);
      return null;
    }
  }

  /**
   * Сохранить сессию пользователя
   */
  async saveSession(
    sessionData: UserSessionData,
    persistToDb: boolean = false
  ): Promise<void> {
    const sessionKey = `${sessionData.botId}-${sessionData.userId}`;

    try {
      // Всегда сохраняем в Redis
      await this.saveToRedis(sessionKey, sessionData);

      // Сохраняем в БД по необходимости
      if (persistToDb || this.shouldPersistToDb(sessionData)) {
        await this.saveToDb(sessionKey, sessionData);
        sessionData.lastSavedToDb = new Date();
      }

      this.logger.debug(`Сессия ${sessionKey} сохранена`);
    } catch (error) {
      this.logger.error(`Ошибка сохранения сессии ${sessionKey}:`, error);
      throw error;
    }
  }

  /**
   * Удалить сессию
   */
  async deleteSession(botId: string, userId: string): Promise<void> {
    const sessionKey = `${botId}-${userId}`;

    try {
      // Удаляем из Redis
      await this.redisService.del(`session:${sessionKey}`);

      // Помечаем как завершенную в БД
      await this.sessionRepository.update(
        { sessionKey },
        {
          status: SessionStatus.COMPLETED,
          updatedAt: new Date(),
        }
      );

      this.logger.log(`Сессия ${sessionKey} удалена`);
    } catch (error) {
      this.logger.error(`Ошибка удаления сессии ${sessionKey}:`, error);
    }
  }

  /**
   * Обновить переменные сессии
   */
  async updateVariables(
    botId: string,
    userId: string,
    variables: Record<string, any>
  ): Promise<void> {
    const sessionKey = `${botId}-${userId}`;
    const session = await this.getSession(botId, userId);

    if (!session) {
      throw new NotFoundException(`Сессия ${sessionKey} не найдена`);
    }

    // Обновляем переменные
    session.variables = {
      ...session.variables,
      ...variables,
    };
    session.lastActivity = new Date();

    // Сохраняем (saveSession обновит и Redis, и БД если нужно)
    await this.saveSession(session, true);
  }

  /**
   * Очистить старые сессии (отмечает в БД как EXPIRED)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const expireDate = new Date();
      expireDate.setFullYear(expireDate.getFullYear() - 1); // Сессии старше 1 года

      const result = await this.sessionRepository.update(
        {
          lastActivity: { $lt: expireDate } as any,
          status: SessionStatus.ACTIVE,
        },
        { status: SessionStatus.EXPIRED }
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(`Помечено как истекших ${result.affected} сессий`);
      }
    } catch (error) {
      this.logger.error("Ошибка очистки истекших сессий:", error);
    }
  }

  /**
   * Фоновая задача для архивации неактивных сессий из Redis в PostgreSQL.
   * Вызывается кроном раз в 10 минут, например в другом модуле или через @Cron здесь.
   * Будем архивировать сессии, которые не обновлялись больше 1 часа (половина TTL).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async archiveInactiveSessions(): Promise<void> {
    try {
      this.logger.verbose("Начинается архивация неактивных сессий из Redis...");
      let archivedCount = 0;

      // Получаем все ключи сессий
      const redisKeys = await this.redisService.getKeys("session:*");
      if (!redisKeys || redisKeys.length === 0) {
        return;
      }

      // Получаем все значения
      const redisValues = await this.redisService.mget(redisKeys);
      const nowMs = Date.now();
      
      // Порог архивации: сессия старше 1 часа (3600 сек)
      const ARCHIVE_THRESHOLD_MS = 60 * 60 * 1000;

      for (let i = 0; i < redisKeys.length; i++) {
        const val = redisValues[i];
        if (val) {
          try {
            const sessionData = JSON.parse(val) as UserSessionData;
            
            // Восстанавливаем даты для корректного сравнения
            const lastActivityDate = sessionData.lastActivity 
              ? new Date(sessionData.lastActivity) 
              : new Date();
              
            const lastSavedToDbDate = sessionData.lastSavedToDb
              ? new Date(sessionData.lastSavedToDb)
              : new Date(0); // Означает "никогда не сохранялась"

            const timeSinceLastActivity = nowMs - lastActivityDate.getTime();
            
            // Если сессия неактивна больше часа И после последней активности она еще не была сохранена в БД
            if (
              timeSinceLastActivity > ARCHIVE_THRESHOLD_MS && 
              lastSavedToDbDate.getTime() < lastActivityDate.getTime()
            ) {
              const sessionKey = `${sessionData.botId}-${sessionData.userId}`;
              
              // Переназначаем в формат Date те поля, которые нужны для saveToDb
              sessionData.lastActivity = lastActivityDate;
              if (sessionData.locationRequest?.timestamp) {
                sessionData.locationRequest.timestamp = new Date(sessionData.locationRequest.timestamp);
              }
              if (sessionData.lobbyData?.joinedAt) {
                sessionData.lobbyData.joinedAt = new Date(sessionData.lobbyData.joinedAt);
              }

              await this.saveToDb(sessionKey, sessionData);
              sessionData.lastSavedToDb = new Date();
              
              // Обновляем Redis, чтобы зафиксировать lastSavedToDb (TTL не сбрасываем, т.к. это архивация)
              const serialized = JSON.stringify(sessionData);
              // Получаем оставшийся TTL из ключа, если нужно сохранить, либо заново ставим стандартный
              // В данном случае просто перезаписываем со стандартным TTL, т.к. он всё равно скоро вытеснится
              await this.redisService.set(redisKeys[i], serialized, { EX: this.SESSION_TTL });

              archivedCount++;
            }
          } catch (e) {
            this.logger.error(`Ошибка архивации сессии ${redisKeys[i]}: ${e.message}`);
          }
        }
      }

      if (archivedCount > 0) {
        this.logger.log(`Успешно архивировано в БД ${archivedCount} неактивных сессий из Redis`);
      }
    } catch (error) {
      this.logger.error("Ошибка при выполнении задачи архивации сессий:", error);
    }
  }

  /**
   * Получить все активные сессии для бота
   */
  async getActiveSessionsForBot(botId: string): Promise<UserSessionData[]> {
    try {
      const mergedSessions = new Map<string, UserSessionData>();

      // 1. Получаем сессии из БД (как базовый слой, так как Redis может очищаться)
      const dbSessions = await this.sessionRepository.find({
        where: {
          botId,
          status: SessionStatus.ACTIVE,
        },
      });

      for (const dbSession of dbSessions) {
        const sessionData = this.entityToData(dbSession);
        const key = `${sessionData.botId}-${sessionData.userId}`;
        mergedSessions.set(key, sessionData);
      }

      // 2. Получаем актуальные сессии из Redis и перетираем ими данные из БД
      const redisPattern = `session:${botId}-*`;
      const redisKeys = await this.redisService.getKeys(redisPattern);

      if (redisKeys && redisKeys.length > 0) {
        const redisValues = await this.redisService.mget(redisKeys);

        for (let i = 0; i < redisKeys.length; i++) {
          const val = redisValues[i];
          if (val) {
            try {
              const session = JSON.parse(val) as UserSessionData;

              // Восстанавливаем объекты Date
              if (session.lastActivity) {
                session.lastActivity = new Date(session.lastActivity);
              }
              if (session.locationRequest?.timestamp) {
                session.locationRequest.timestamp = new Date(session.locationRequest.timestamp);
              }
              if (session.lobbyData?.joinedAt) {
                session.lobbyData.joinedAt = new Date(session.lobbyData.joinedAt);
              }
              if (session.lastSavedToDb) {
                session.lastSavedToDb = new Date(session.lastSavedToDb);
              }

              const key = `${session.botId}-${session.userId}`;
              mergedSessions.set(key, session);
            } catch (e) {
              this.logger.error(`Ошибка парсинга сессии из Redis: ${redisKeys[i]}`);
            }
          }
        }
      }

      // 3. Отдаем в виде массива, сортируя по lastActivity
      return Array.from(mergedSessions.values()).sort((a, b) => {
        const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      this.logger.error(
        `Ошибка получения активных сессий для бота ${botId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Получить сессии, ожидающие данные на конкретной ноде
   */
  async getSessionsWaitingOnNode(
    botId: string,
    nodeId: string
  ): Promise<UserSessionData[]> {
    try {
      const dbSessions = await this.sessionRepository.find({
        where: {
          botId,
          currentNodeId: nodeId,
          status: SessionStatus.ACTIVE,
        },
        order: { lastActivity: "DESC" },
      });

      return dbSessions.map((session) => this.entityToData(session));
    } catch (error) {
      this.logger.error(
        `Ошибка получения сессий, ожидающих на ноде ${nodeId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Перенести все сессии из памяти в постоянное хранилище
   * Используется для миграции существующих сессий
   */
  async migrateInMemorySessions(
    inMemorySessions: Map<string, UserSessionData>
  ): Promise<void> {
    let migratedCount = 0;

    for (const [sessionKey, sessionData] of inMemorySessions.entries()) {
      try {
        await this.saveSession(sessionData, true); // Сохраняем сразу в БД
        migratedCount++;
      } catch (error) {
        this.logger.error(`Ошибка миграции сессии ${sessionKey}:`, error);
      }
    }

    this.logger.log(`Мигрировано ${migratedCount} сессий из памяти`);
  }

  // Приватные методы

  private async saveToRedis(
    sessionKey: string,
    sessionData: UserSessionData
  ): Promise<void> {
    const redisKey = `session:${sessionKey}`;
    const serialized = JSON.stringify(sessionData);

    await this.redisService.set(redisKey, serialized, { EX: this.SESSION_TTL });
  }

  private async saveToDb(
    sessionKey: string,
    sessionData: UserSessionData
  ): Promise<void> {
    const existingSession = await this.sessionRepository.findOne({
      where: { sessionKey },
    });

    const sessionEntity = existingSession || new UserSession();

    // Обновляем данные
    sessionEntity.sessionKey = sessionKey;
    sessionEntity.userId = sessionData.userId;
    sessionEntity.chatId = sessionData.chatId;
    sessionEntity.botId = sessionData.botId;
    sessionEntity.currentNodeId = sessionData.currentNodeId;
    sessionEntity.variables = sessionData.variables;
    sessionEntity.lastActivity = sessionData.lastActivity;
    sessionEntity.locationRequest = sessionData.locationRequest;
    sessionEntity.sessionType =
      sessionData.sessionType || SessionType.INDIVIDUAL;
    sessionEntity.lobbyData = sessionData.lobbyData;
    sessionEntity.status = SessionStatus.ACTIVE;

    if (existingSession) {
      sessionEntity.updatedAt = new Date();
    }

    await this.sessionRepository.save(sessionEntity);
  }

  private shouldPersistToDb(sessionData: UserSessionData): boolean {
    // Сохраняем в БД критичные состояния
    return !!(
      (
        sessionData.currentNodeId?.includes("endpoint") || // Ожидание данных
        sessionData.variables["payment_status"] === "pending" || // Ожидание оплаты
        sessionData.variables["lobby_id"] || // Лобби сессии
        (sessionData.sessionType === SessionType.LOBBY &&
          this.isCriticalLobbyState(sessionData))
      ) // Лобби в критичном состоянии
    );
  }

  private isCriticalLobbyState(sessionData: UserSessionData): boolean {
    // Сохраняем лобби сессии в БД только в критичных состояниях
    return !!(
      (
        sessionData.variables["game_started"] || // Игра началась
        sessionData.variables["auction_active"] || // Активный аукцион
        sessionData.variables["waiting_for_players"] || // Ожидание игроков
        sessionData.variables["payment_required"] || // Требуется оплата
        (sessionData.lobbyData?.participantVariables &&
          Object.keys(sessionData.lobbyData.participantVariables).length > 0)
      ) // Есть данные участников
    );
  }

  private entityToData(entity: UserSession): UserSessionData {
    return {
      userId: entity.userId,
      chatId: entity.chatId,
      botId: entity.botId,
      currentNodeId: entity.currentNodeId,
      variables: entity.variables,
      lastActivity: entity.lastActivity,
      locationRequest: entity.locationRequest,
      sessionType: entity.sessionType,
      lobbyData: entity.lobbyData,
      lastSavedToDb: entity.updatedAt || entity.createdAt,
    };
  }
}
