import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Bot } from "./bot.entity";

export enum SessionStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export enum SessionType {
  INDIVIDUAL = "individual",
  LOBBY = "lobby",
}

@Entity("user_sessions")
@Index(["botId", "userId"])
@Index(["botId", "status"])
@Index(["lastActivity"])
export class UserSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  sessionKey: string; // `${botId}-${userId}`

  @Column()
  userId: string;

  @Column()
  chatId: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "botId" })
  bot: Bot;

  @Column({ nullable: true })
  currentNodeId: string;

  @Column({ type: "jsonb" })
  variables: Record<string, any>;

  @Column({ type: "timestamp" })
  lastActivity: Date;

  @Column({
    type: "enum",
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({
    type: "enum",
    enum: SessionType,
    default: SessionType.INDIVIDUAL,
  })
  sessionType: SessionType;

  @Column({ type: "jsonb", nullable: true })
  locationRequest: {
    nodeId: string;
    timestamp: Date;
    timeout: number;
  };

  @Column({ type: "jsonb", nullable: true })
  lobbyData: {
    lobbyId: string;
    participantVariables: Record<string, any>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Методы
  get isActive(): boolean {
    return this.status === SessionStatus.ACTIVE;
  }

  get isExpired(): boolean {
    const ttl = this.getTTL();
    const now = new Date();
    const expireTime = new Date(this.lastActivity.getTime() + ttl * 1000);
    return now > expireTime;
  }

  get isLobbySession(): boolean {
    return this.sessionType === SessionType.LOBBY;
  }

  private getTTL(): number {
    // TTL в секундах
    if (this.isLobbySession) return 365 * 24 * 60 * 60; // 1 год для лобби
    return 365 * 24 * 60 * 60; // 1 год для обычных сессий
  }
}
