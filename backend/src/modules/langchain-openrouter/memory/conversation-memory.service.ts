import { Injectable, Logger } from "@nestjs/common";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatMessageDto, MessageRole } from "../dto/langchain-chat.dto";

/**
 * Интерфейс для хранилища сессий
 */
interface SessionStore {
  [sessionId: string]: {
    messages: BaseMessage[];
    createdAt: Date;
    lastAccessedAt: Date;
    messageCount: number;
  };
}

/**
 * Сервис для управления памятью разговоров
 * Позволяет сохранять и восстанавливать историю сообщений между запросами
 */
@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);
  private readonly sessions: SessionStore = {};
  private readonly maxSessionAge = 24 * 60 * 60 * 1000; // 24 часа
  private readonly maxMessagesPerSession = 100;

  constructor() {
    // Запускаем очистку старых сессий каждый час
    setInterval(() => this.cleanupOldSessions(), 60 * 60 * 1000);
    this.logger.log("ConversationMemoryService инициализирован");
  }

  /**
   * Получает или создает историю сообщений для сессии
   */
  private getOrCreateSession(sessionId: string) {
    if (!this.sessions[sessionId]) {
      this.logger.debug(`Создание новой сессии: ${sessionId}`);
      
      this.sessions[sessionId] = {
        messages: [],
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        messageCount: 0,
      };
    } else {
      this.sessions[sessionId].lastAccessedAt = new Date();
    }

    return this.sessions[sessionId];
  }

  /**
   * Добавляет сообщение в историю сессии
   */
  async addMessage(sessionId: string, message: ChatMessageDto): Promise<void> {
    const session = this.getOrCreateSession(sessionId);
    
    let langchainMessage: BaseMessage;
    
    switch (message.role) {
      case MessageRole.SYSTEM:
        langchainMessage = new SystemMessage(message.content);
        break;
      case MessageRole.HUMAN:
        langchainMessage = new HumanMessage(message.content);
        break;
      case MessageRole.AI:
        langchainMessage = new AIMessage(message.content);
        break;
      default:
        langchainMessage = new HumanMessage(message.content);
    }

    session.messages.push(langchainMessage);
    session.messageCount++;

    // Ограничиваем количество сообщений
    this.trimHistory(sessionId);

    this.logger.debug(
      `Добавлено сообщение в сессию ${sessionId}. Всего: ${session.messageCount}`,
    );
  }

  /**
   * Получает все сообщения из истории сессии
   */
  async getMessages(sessionId: string): Promise<BaseMessage[]> {
    const session = this.getOrCreateSession(sessionId);
    return session.messages;
  }

  /**
   * Получает последние N сообщений из сессии
   */
  async getLastMessages(
    sessionId: string,
    count: number,
  ): Promise<BaseMessage[]> {
    const messages = await this.getMessages(sessionId);
    return messages.slice(-count);
  }

  /**
   * Очищает историю сессии
   */
  async clearSession(sessionId: string): Promise<void> {
    if (this.sessions[sessionId]) {
      delete this.sessions[sessionId];
      this.logger.debug(`Сессия ${sessionId} очищена`);
    }
  }

  /**
   * Ограничивает количество сообщений в истории
   */
  private trimHistory(sessionId: string): void {
    const session = this.sessions[sessionId];
    if (!session) return;

    if (session.messageCount > this.maxMessagesPerSession) {
      const messagesToKeep = session.messages.slice(-this.maxMessagesPerSession);
      session.messages = messagesToKeep;
      session.messageCount = messagesToKeep.length;
      
      this.logger.debug(
        `История сессии ${sessionId} обрезана до ${this.maxMessagesPerSession} сообщений`,
      );
    }
  }

  /**
   * Очищает старые неактивные сессии
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const sessionId in this.sessions) {
      const session = this.sessions[sessionId];
      const age = now - session.lastAccessedAt.getTime();

      if (age > this.maxSessionAge) {
        delete this.sessions[sessionId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(
        `Очищено ${cleanedCount} старых сессий. Активных: ${Object.keys(this.sessions).length}`,
      );
    }
  }

  /**
   * Получает статистику по сессиям
   */
  getStats() {
    const sessionIds = Object.keys(this.sessions);
    const totalSessions = sessionIds.length;
    const totalMessages = sessionIds.reduce(
      (sum, id) => sum + this.sessions[id].messageCount,
      0,
    );

    return {
      totalSessions,
      totalMessages,
      averageMessagesPerSession:
        totalSessions > 0 ? (totalMessages / totalSessions).toFixed(2) : "0",
      oldestSession: sessionIds.length > 0
        ? Math.min(
            ...sessionIds.map((id) => this.sessions[id].createdAt.getTime()),
          )
        : null,
    };
  }

  /**
   * Получает информацию о конкретной сессии
   */
  getSessionInfo(sessionId: string) {
    const session = this.sessions[sessionId];
    
    if (!session) {
      return null;
    }

    return {
      sessionId,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      messageCount: session.messageCount,
      ageInMinutes: Math.floor(
        (Date.now() - session.createdAt.getTime()) / (1000 * 60),
      ),
    };
  }

  /**
   * Экспортирует историю сессии в JSON
   */
  async exportSession(sessionId: string): Promise<any> {
    const messages = await this.getMessages(sessionId);
    const info = this.getSessionInfo(sessionId);

    return {
      sessionInfo: info,
      messages: messages.map((msg) => ({
        type: msg._getType(),
        content: msg.content,
      })),
    };
  }

  /**
   * Импортирует историю сессии из JSON
   */
  async importSession(sessionId: string, data: any): Promise<void> {
    await this.clearSession(sessionId);
    
    const session = this.getOrCreateSession(sessionId);

    for (const msgData of data.messages) {
      let message: BaseMessage;
      
      switch (msgData.type) {
        case "system":
          message = new SystemMessage(msgData.content);
          break;
        case "human":
          message = new HumanMessage(msgData.content);
          break;
        case "ai":
          message = new AIMessage(msgData.content);
          break;
        default:
          message = new HumanMessage(msgData.content);
      }

      session.messages.push(message);
      session.messageCount++;
    }

    this.logger.log(
      `Импортирована сессия ${sessionId} с ${data.messages.length} сообщениями`,
    );
  }
}

