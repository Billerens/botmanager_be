import { Injectable, Inject, Logger, OnModuleDestroy } from "@nestjs/common";
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
    lobbyId: string;
    participantVariables: Record<string, any>;
  };
}

@Injectable()
export class SessionStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStorageService.name);

  // TTL в секундах (1 год = 365 * 24 * 60 * 60)
  private readonly SESSION_TTL = 365 * 24 * 60 * 60;

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
   * Очистить старые сессии
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
   * Получить все активные сессии для бота
   */
  async getActiveSessionsForBot(botId: string): Promise<UserSessionData[]> {
    try {
      // Получаем сессии из БД (Redis может содержать не все)
      const dbSessions = await this.sessionRepository.find({
        where: {
          botId,
          status: SessionStatus.ACTIVE,
        },
        order: { lastActivity: "DESC" },
      });

      return dbSessions.map((session) => this.entityToData(session));
    } catch (error) {
      this.logger.error(
        `Ошибка получения активных сессий для бота ${botId}:`,
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

    await this.redisService.set(redisKey, serialized, "EX", this.SESSION_TTL);
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
    };
  }
}
