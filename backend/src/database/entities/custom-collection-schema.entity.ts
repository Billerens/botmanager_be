import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * Тип владельца кастомной коллекции
 */
export enum CustomDataOwnerType {
  BOT = "bot",
  SHOP = "shop",
  BOOKING = "booking",
  CUSTOM_PAGE = "custom_page",
  CUSTOM_APP = "custom_app",
}

/**
 * Типы полей в схеме коллекции
 */
export enum FieldType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  ARRAY = "array",
  OBJECT = "object",
  TEXT = "text", // длинный текст
  EMAIL = "email",
  URL = "url",
  PHONE = "phone",
  SELECT = "select", // enum/выбор из списка
  MULTISELECT = "multiselect", // множественный выбор
  FILE = "file", // ссылка на файл
  IMAGE = "image", // ссылка на изображение
  RELATION = "relation", // связь с другой коллекцией
}

/**
 * Тип связи между коллекциями
 */
export enum RelationType {
  ONE_TO_ONE = "one-to-one",
  ONE_TO_MANY = "one-to-many",
  MANY_TO_ONE = "many-to-one",
}

/**
 * Интерфейс для описания поля схемы
 */
export interface FieldSchema {
  type: FieldType;
  required?: boolean;
  default?: any;
  description?: string;
  // Для строк
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex pattern
  // Для чисел
  minimum?: number;
  maximum?: number;
  // Для select/multiselect
  options?: { value: string; label: string }[];
  // Для массивов
  items?: { type: FieldType };
  // Для связей
  relation?: {
    targetCollection: string;
    type: RelationType;
    displayField?: string; // поле для отображения связанной записи
  };
  // UI hints
  placeholder?: string;
  helpText?: string;
  hidden?: boolean; // скрыто в UI
  readOnly?: boolean;
  sortOrder?: number; // порядок отображения в UI
}

/**
 * Интерфейс схемы коллекции
 */
export interface CollectionSchemaDefinition {
  type: "object";
  properties: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Интерфейс для описания связи между коллекциями
 */
export interface CollectionRelation {
  fieldName: string;
  targetCollection: string;
  type: RelationType;
  onDelete?: "cascade" | "set-null" | "restrict";
}

/**
 * Настройки публичного доступа к коллекции
 */
export interface CollectionAccessSettings {
  /**
   * Доступ для неавторизованных пользователей (только API Key)
   */
  public: {
    /** Разрешено читать отдельные записи */
    read: boolean;
    /** Разрешено получать список записей */
    list: boolean;
  };
  /**
   * Доступ для авторизованных пользователей (Telegram/Browser session + API Key)
   */
  authenticated: {
    /** Разрешено читать отдельные записи */
    read: boolean;
    /** Разрешено получать список записей */
    list: boolean;
    /** Разрешено создавать записи */
    create: boolean;
    /** Разрешено обновлять записи (с учётом RLS) */
    update: boolean;
    /** Разрешено удалять записи (с учётом RLS) */
    delete: boolean;
  };
}

/**
 * Правила Row-Level Security
 * Выражения вычисляются для каждой записи
 * Доступные переменные:
 * - @userId: ID текущего пользователя (Telegram userId или browser session userId)
 * - @userEmail: Email пользователя (для browser session)
 * - @now: Текущее время
 * - data.*: Поля текущей записи
 */
export interface RowLevelSecurityRules {
  /**
   * Условие для чтения записи
   * Пример: "true" (все записи), "data.isPublished = true", "data.createdBy = @userId"
   */
  read: string;
  /**
   * Условие для создания записи
   * Пример: "true" (разрешено всем авторизованным)
   */
  create: string;
  /**
   * Условие для обновления записи
   * Пример: "data.createdBy = @userId" (только свои записи)
   */
  update: string;
  /**
   * Условие для удаления записи
   * Пример: "data.createdBy = @userId" (только свои записи)
   */
  delete: string;
}

/**
 * Значения по умолчанию для настроек доступа
 */
export const DEFAULT_ACCESS_SETTINGS: CollectionAccessSettings = {
  public: {
    read: false,
    list: false,
  },
  authenticated: {
    read: true,
    list: true,
    create: false,
    update: false,
    delete: false,
  },
};

/**
 * Значения по умолчанию для RLS правил
 */
export const DEFAULT_RLS_RULES: RowLevelSecurityRules = {
  read: "true", // Все записи видны (фильтрация через accessSettings)
  create: "true", // Создание разрешено (если accessSettings позволяет)
  update: "data.createdBy = @userId", // Обновлять только свои записи
  delete: "data.createdBy = @userId", // Удалять только свои записи
};

/**
 * Entity для хранения схем кастомных коллекций
 * 
 * Позволяет пользователям определять структуру своих "таблиц"
 * с валидацией, типизацией и связями между коллекциями.
 */
@Entity("custom_collection_schemas")
@Index(["ownerId", "ownerType", "collectionName"], { unique: true })
@Index(["ownerId", "ownerType"])
export class CustomCollectionSchema {
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
   * Системное имя коллекции (slug)
   * Используется в API и внутренней логике
   */
  @Column()
  collectionName: string;

  /**
   * Отображаемое имя коллекции
   */
  @Column({ nullable: true })
  displayName?: string;

  /**
   * Описание коллекции
   */
  @Column({ type: "text", nullable: true })
  description?: string;

  /**
   * Иконка коллекции (emoji или название иконки)
   */
  @Column({ nullable: true })
  icon?: string;

  /**
   * JSON Schema для валидации структуры записей
   */
  @Column({ type: "jsonb" })
  schema: CollectionSchemaDefinition;

  /**
   * Поля, по которым можно выполнять поиск и фильтрацию
   * Эти поля извлекаются в отдельную колонку для быстрого доступа
   */
  @Column({ type: "jsonb", default: [] })
  indexedFields: string[];

  /**
   * Поле, используемое как "title" записи (для отображения в списках и связях)
   */
  @Column({ nullable: true })
  titleField?: string;

  /**
   * Связи с другими коллекциями
   */
  @Column({ type: "jsonb", nullable: true })
  relations?: CollectionRelation[];

  /**
   * Настройки UI для редактора
   */
  @Column({ type: "jsonb", nullable: true })
  uiSettings?: {
    defaultView?: "table" | "cards" | "list";
    columnsOrder?: string[];
    hiddenColumns?: string[];
    sortField?: string;
    sortDirection?: "asc" | "desc";
    pageSize?: number;
  };

  /**
   * Настройки публичного доступа к коллекции
   */
  @Column({ type: "jsonb", default: DEFAULT_ACCESS_SETTINGS })
  accessSettings: CollectionAccessSettings;

  /**
   * Правила Row-Level Security
   */
  @Column({ type: "jsonb", default: DEFAULT_RLS_RULES })
  rowLevelSecurity: RowLevelSecurityRules;

  /**
   * Активна ли коллекция
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Мягкое удаление
   */
  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ============= Вычисляемые свойства =============

  /**
   * Получить список всех полей схемы
   */
  get fieldNames(): string[] {
    return Object.keys(this.schema?.properties || {});
  }

  /**
   * Получить список обязательных полей
   */
  get requiredFields(): string[] {
    return this.schema?.required || [];
  }

  /**
   * Проверить, есть ли связи у коллекции
   */
  get hasRelations(): boolean {
    return (this.relations?.length || 0) > 0;
  }
}
