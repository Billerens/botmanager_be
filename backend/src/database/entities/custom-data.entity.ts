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
import { CustomCollectionSchema, CustomDataOwnerType } from "./custom-collection-schema.entity";

/**
 * Entity для хранения кастомных данных пользователей
 * 
 * Универсальное хранилище данных с поддержкой:
 * - Произвольной структуры (JSONB)
 * - Индексируемых полей для быстрого поиска
 * - Версионирования
 * - Soft delete
 * - Связей между записями
 */
@Entity("custom_data")
@Index(["ownerId", "ownerType", "collection"])
@Index(["ownerId", "ownerType", "collection", "key"], { unique: true })
@Index(["ownerId", "ownerType", "collection", "isDeleted"])
export class CustomData {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * ID владельца (бот, магазин, система бронирования и т.д.)
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
   * Имя коллекции
   */
  @Column()
  collection: string;

  /**
   * Связь со схемой коллекции (опционально)
   */
  @ManyToOne(() => CustomCollectionSchema, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "schemaId" })
  schema?: CustomCollectionSchema;

  @Column({ nullable: true })
  schemaId?: string;

  /**
   * Уникальный ключ записи в рамках коллекции
   * Может быть автогенерирован или задан пользователем
   */
  @Column()
  key: string;

  /**
   * Основные данные записи (произвольная структура)
   */
  @Column({ type: "jsonb" })
  data: Record<string, any>;

  /**
   * Извлечённые индексируемые поля для быстрого поиска
   * Заполняется автоматически на основе схемы коллекции
   */
  @Column({ type: "jsonb", nullable: true })
  indexedData?: Record<string, any>;

  /**
   * Дополнительные метаданные
   * (теги, категории, кастомные флаги и т.д.)
   */
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  /**
   * Заголовок записи (для отображения в списках)
   * Заполняется из titleField схемы
   */
  @Column({ nullable: true })
  title?: string;

  /**
   * Версия записи (для оптимистичной блокировки)
   */
  @Column({ default: 1 })
  version: number;

  /**
   * Порядок сортировки (для ручной сортировки)
   */
  @Column({ nullable: true })
  sortOrder?: number;

  /**
   * Мягкое удаление
   */
  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  /**
   * Кто создал запись (user ID или public user ID)
   */
  @Column({ nullable: true })
  createdBy?: string;

  /**
   * Кто последний обновил запись
   */
  @Column({ nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ============= Вычисляемые свойства =============

  /**
   * Получить значение поля из data
   */
  getValue<T = any>(fieldName: string): T | undefined {
    return this.data?.[fieldName] as T;
  }

  /**
   * Проверить, содержит ли запись определённое поле
   */
  hasField(fieldName: string): boolean {
    return this.data && fieldName in this.data;
  }

  /**
   * Получить краткое представление для логов
   */
  get shortInfo(): string {
    return `CustomData[${this.collection}/${this.key}]`;
  }
}
