import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { CustomDataOwnerType } from "./custom-collection-schema.entity";

/**
 * Публичный API ключ для доступа к кастомным данным.
 * Позволяет клиентским приложениям получать доступ к данным владельца.
 */
@Entity("public_api_keys")
@Index(["ownerId", "ownerType"])
@Index(["key"], { unique: true })
export class PublicApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * Сам API ключ (публичный, передаётся в заголовке запроса)
   * Формат: pk_live_<random> или pk_test_<random>
   */
  @Column({ unique: true })
  key: string;

  /**
   * Название ключа для идентификации в UI
   */
  @Column()
  name: string;

  /**
   * ID владельца (бот, магазин, система бронирования, страница)
   */
  @Column()
  ownerId: string;

  /**
   * Тип владельца
   */
  @Column({
    type: "enum",
    enum: CustomDataOwnerType,
  })
  ownerType: CustomDataOwnerType;

  /**
   * Описание ключа
   */
  @Column({ type: "text", nullable: true })
  description?: string;

  /**
   * Активен ли ключ
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Тестовый режим (для разработки)
   */
  @Column({ default: false })
  isTestMode: boolean;

  /**
   * Разрешённые домены (CORS whitelist)
   * Если пусто - разрешены все домены
   */
  @Column({ type: "jsonb", default: [] })
  allowedDomains: string[];

  /**
   * Разрешённые IP адреса
   * Если пусто - разрешены все IP
   */
  @Column({ type: "jsonb", default: [] })
  allowedIps: string[];

  /**
   * Rate limit (запросов в минуту)
   * 0 = без ограничений
   */
  @Column({ default: 60 })
  rateLimit: number;

  /**
   * Дата истечения ключа
   * null = бессрочный
   */
  @Column({ type: "timestamp", nullable: true })
  expiresAt?: Date;

  /**
   * Последнее использование ключа
   */
  @Column({ type: "timestamp", nullable: true })
  lastUsedAt?: Date;

  /**
   * Счётчик использований
   */
  @Column({ type: "bigint", default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Генерирует новый API ключ
 */
export function generateApiKey(isTestMode = false): string {
  const prefix = isTestMode ? "pk_test_" : "pk_live_";
  const randomPart = Array.from({ length: 32 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36))
  ).join("");
  return `${prefix}${randomPart}`;
}
