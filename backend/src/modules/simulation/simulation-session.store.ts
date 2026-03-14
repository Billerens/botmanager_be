import { Injectable, Logger } from "@nestjs/common";

/**
 * Данные одной сессии симуляции.
 * Полностью изолированы от production-сессий.
 */
export interface SimulationSessionData {
  /** Уникальный ID сессии симуляции */
  simulationId: string;
  /** ID бота */
  botId: string;
  /** ID flow (если задан) */
  flowId?: string;
  /** ID пользователя-владельца (из JWT) */
  ownerId: string;
  /** WebSocket client ID */
  socketId: string;
  /** Текущий nodeId в flow */
  currentNodeId?: string;
  /** Изолированные переменные сессии */
  variables: Record<string, any>;
  /** Снапшот customData (custom_storage) — in-memory копия при старте */
  customStorageSnapshot: Map<string, any>;
  /** Снапшот customData (new custom_data system) — in-memory копия при старте */
  customDataSnapshot: Map<string, any>;
  /** Время последней активности */
  lastActivity: Date;
  /** Время создания */
  createdAt: Date;
  /** Активные periodic-таймеры (nodeId → timeoutId) */
  periodicTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Счётчики выполнений periodic-задач (nodeId → count) */
  periodicCounts: Map<string, number>;
}

/**
 * In-memory хранилище сессий симуляции.
 *
 * Каждая сессия полностью изолирована — свои variables, customData.
 * TTL-based: сессии удаляются после 30 минут бездействия.
 *
 * Сложность:
 *   get/set/delete — O(1) (Map)
 *   cleanup — O(n) по количеству сессий (каждые 5 мин)
 */
@Injectable()
export class SimulationSessionStore {
  private readonly logger = new Logger(SimulationSessionStore.name);

  /** simulationId → SimulationSessionData */
  private readonly sessions = new Map<string, SimulationSessionData>();

  /** socketId → simulationId (для быстрого поиска при disconnect) */
  private readonly socketIndex = new Map<string, string>();

  /** TTL: 30 минут бездействия */
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;

  /** Лимит одновременных сессий (защита от abuse) */
  private readonly MAX_SESSIONS = 100;

  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Запускаем периодическую очистку каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Создать новую сессию симуляции
   */
  create(data: Omit<SimulationSessionData, "createdAt" | "lastActivity" | "periodicTimers" | "periodicCounts">): SimulationSessionData {
    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error("Превышен лимит одновременных сессий симуляции");
    }

    const session: SimulationSessionData = {
      ...data,
      createdAt: new Date(),
      lastActivity: new Date(),
      periodicTimers: new Map(),
      periodicCounts: new Map(),
    };

    this.sessions.set(session.simulationId, session);
    this.socketIndex.set(session.socketId, session.simulationId);

    this.logger.log(`Сессия симуляции создана: ${session.simulationId} (bot: ${session.botId})`);
    return session;
  }

  /**
   * Получить сессию по simulationId
   */
  get(simulationId: string): SimulationSessionData | undefined {
    return this.sessions.get(simulationId);
  }

  /**
   * Получить сессию по socketId
   */
  getBySocketId(socketId: string): SimulationSessionData | undefined {
    const simulationId = this.socketIndex.get(socketId);
    if (!simulationId) return undefined;
    return this.sessions.get(simulationId);
  }

  /**
   * Обновить lastActivity (продлить TTL)
   */
  touch(simulationId: string): void {
    const session = this.sessions.get(simulationId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Удалить сессию и очистить все periodic-таймеры
   */
  delete(simulationId: string): boolean {
    const session = this.sessions.get(simulationId);
    if (!session) return false;

    // Очищаем все periodic-таймеры
    for (const [nodeId, timer] of session.periodicTimers) {
      clearTimeout(timer);
      this.logger.debug(`Periodic timer для ${nodeId} очищен`);
    }
    session.periodicTimers.clear();

    this.socketIndex.delete(session.socketId);
    this.sessions.delete(simulationId);

    this.logger.log(`Сессия симуляции удалена: ${simulationId}`);
    return true;
  }

  /**
   * Удалить все сессии для socketId (при disconnect)
   */
  deleteBySocketId(socketId: string): void {
    const simulationId = this.socketIndex.get(socketId);
    if (simulationId) {
      this.delete(simulationId);
    }
  }

  /**
   * Очистка истекших сессий (TTL)
   * O(n) по количеству сессий
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.SESSION_TTL_MS) {
        this.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Очищено ${cleanedCount} истекших сессий симуляции`);
    }
  }

  /**
   * Получить количество активных сессий (для мониторинга)
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /**
   * Остановка при завершении модуля
   */
  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);

    // Очищаем все periodic-таймеры
    for (const [id] of this.sessions) {
      this.delete(id);
    }
  }
}
