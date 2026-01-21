import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CustomCollectionSchema,
  CustomDataOwnerType,
  CollectionAccessSettings,
  RowLevelSecurityRules,
} from "../../database/entities/custom-collection-schema.entity";
import { CustomData } from "../../database/entities/custom-data.entity";
import { ApiKeyContext } from "./public-api-key.service";

/**
 * Контекст публичного пользователя (из Telegram или browser session)
 */
export interface PublicUserContext {
  /** Telegram user ID или browser session user ID */
  userId?: string;
  /** Email пользователя (для browser session) */
  userEmail?: string;
  /** Имя пользователя */
  userName?: string;
  /** Авторизован ли пользователь */
  isAuthenticated: boolean;
}

export interface PublicFindParams {
  filter?: Record<string, any>;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PublicCreateDto {
  key?: string;
  data: Record<string, any>;
}

export interface PublicUpdateDto {
  data: Record<string, any>;
}

@Injectable()
export class PublicCustomDataService {
  private readonly logger = new Logger(PublicCustomDataService.name);

  constructor(
    @InjectRepository(CustomCollectionSchema)
    private readonly schemaRepository: Repository<CustomCollectionSchema>,
    @InjectRepository(CustomData)
    private readonly dataRepository: Repository<CustomData>,
  ) {}

  /**
   * Получить список коллекций (только публичные)
   */
  async getPublicCollections(
    apiKeyContext: ApiKeyContext,
    userContext: PublicUserContext,
  ): Promise<Partial<CustomCollectionSchema>[]> {
    const collections = await this.schemaRepository.find({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        isActive: true,
        isDeleted: false,
      },
    });

    // Фильтруем только коллекции с публичным доступом
    return collections
      .filter((c) => this.canAccessCollection(c.accessSettings, userContext, "list"))
      .map((c) => ({
        collectionName: c.collectionName,
        displayName: c.displayName,
        description: c.description,
        icon: c.icon,
        schema: c.schema,
        titleField: c.titleField,
      }));
  }

  /**
   * Получить схему коллекции
   */
  async getCollectionSchema(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    userContext: PublicUserContext,
  ): Promise<Partial<CustomCollectionSchema>> {
    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "read",
    );

    return {
      collectionName: collection.collectionName,
      displayName: collection.displayName,
      description: collection.description,
      icon: collection.icon,
      schema: collection.schema,
      titleField: collection.titleField,
    };
  }

  /**
   * Получить список записей коллекции
   */
  async findRecords(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    userContext: PublicUserContext,
    params: PublicFindParams = {},
  ): Promise<{ data: CustomData[]; total: number; hasMore: boolean }> {
    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "list",
    );

    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    // Строим базовый запрос
    let queryBuilder = this.dataRepository
      .createQueryBuilder("data")
      .where("data.ownerId = :ownerId", { ownerId: apiKeyContext.ownerId })
      .andWhere("data.ownerType = :ownerType", { ownerType: apiKeyContext.ownerType })
      .andWhere("data.collection = :collection", { collection: collectionName })
      .andWhere("data.isDeleted = false");

    // Применяем RLS фильтр для чтения
    const rlsCondition = this.buildRlsCondition(
      collection.rowLevelSecurity.read,
      userContext,
    );
    if (rlsCondition) {
      queryBuilder = queryBuilder.andWhere(rlsCondition.sql, rlsCondition.params);
    }

    // Применяем пользовательский фильтр
    if (params.filter) {
      const filterCondition = this.buildFilterCondition(params.filter);
      if (filterCondition) {
        queryBuilder = queryBuilder.andWhere(filterCondition.sql, filterCondition.params);
      }
    }

    // Применяем поиск
    if (params.search && collection.titleField) {
      queryBuilder = queryBuilder.andWhere(
        `data.data->>'${collection.titleField}' ILIKE :search`,
        { search: `%${params.search}%` },
      );
    }

    // Сортировка
    if (params.sortBy) {
      const direction = params.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
      queryBuilder = queryBuilder.orderBy(
        `data.data->>'${params.sortBy}'`,
        direction as "ASC" | "DESC",
      );
    } else {
      queryBuilder = queryBuilder.orderBy("data.createdAt", "DESC");
    }

    // Получаем общее количество
    const total = await queryBuilder.getCount();

    // Применяем пагинацию
    const data = await queryBuilder.skip(offset).take(limit).getMany();

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Получить запись по ключу
   */
  async getRecord(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    key: string,
    userContext: PublicUserContext,
  ): Promise<CustomData> {
    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "read",
    );

    const record = await this.dataRepository.findOne({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        collection: collectionName,
        key,
        isDeleted: false,
      },
    });

    if (!record) {
      throw new NotFoundException("Запись не найдена");
    }

    // Проверяем RLS для чтения
    if (!this.evaluateRlsRule(collection.rowLevelSecurity.read, record, userContext)) {
      throw new ForbiddenException("Нет доступа к этой записи");
    }

    return record;
  }

  /**
   * Создать запись
   */
  async createRecord(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    dto: PublicCreateDto,
    userContext: PublicUserContext,
  ): Promise<CustomData> {
    if (!userContext.isAuthenticated) {
      throw new ForbiddenException("Требуется авторизация для создания записей");
    }

    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "create",
    );

    // Проверяем RLS для создания
    const mockRecord = { data: dto.data } as CustomData;
    if (!this.evaluateRlsRule(collection.rowLevelSecurity.create, mockRecord, userContext)) {
      throw new ForbiddenException("Создание записи запрещено правилами безопасности");
    }

    // Генерируем ключ если не указан
    const key = dto.key || this.generateKey();

    // Проверяем уникальность ключа
    const existing = await this.dataRepository.findOne({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        collection: collectionName,
        key,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException("Запись с таким ключом уже существует");
    }

    // Добавляем информацию о создателе
    const dataWithCreator = {
      ...dto.data,
      createdBy: userContext.userId,
      createdByEmail: userContext.userEmail,
    };

    const record = this.dataRepository.create({
      ownerId: apiKeyContext.ownerId,
      ownerType: apiKeyContext.ownerType,
      collection: collectionName,
      key,
      data: dataWithCreator,
    });

    return this.dataRepository.save(record);
  }

  /**
   * Обновить запись
   */
  async updateRecord(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    key: string,
    dto: PublicUpdateDto,
    userContext: PublicUserContext,
  ): Promise<CustomData> {
    if (!userContext.isAuthenticated) {
      throw new ForbiddenException("Требуется авторизация для обновления записей");
    }

    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "update",
    );

    const record = await this.dataRepository.findOne({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        collection: collectionName,
        key,
        isDeleted: false,
      },
    });

    if (!record) {
      throw new NotFoundException("Запись не найдена");
    }

    // Проверяем RLS для обновления
    if (!this.evaluateRlsRule(collection.rowLevelSecurity.update, record, userContext)) {
      throw new ForbiddenException("Обновление этой записи запрещено");
    }

    // Обновляем данные, сохраняя информацию о создателе
    record.data = {
      ...record.data,
      ...dto.data,
      createdBy: record.data.createdBy,
      createdByEmail: record.data.createdByEmail,
      updatedBy: userContext.userId,
      updatedAt: new Date().toISOString(),
    };
    record.version += 1;

    return this.dataRepository.save(record);
  }

  /**
   * Удалить запись (мягкое удаление)
   */
  async deleteRecord(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    key: string,
    userContext: PublicUserContext,
  ): Promise<void> {
    if (!userContext.isAuthenticated) {
      throw new ForbiddenException("Требуется авторизация для удаления записей");
    }

    const collection = await this.getCollectionWithAccessCheck(
      apiKeyContext,
      collectionName,
      userContext,
      "delete",
    );

    const record = await this.dataRepository.findOne({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        collection: collectionName,
        key,
        isDeleted: false,
      },
    });

    if (!record) {
      throw new NotFoundException("Запись не найдена");
    }

    // Проверяем RLS для удаления
    if (!this.evaluateRlsRule(collection.rowLevelSecurity.delete, record, userContext)) {
      throw new ForbiddenException("Удаление этой записи запрещено");
    }

    record.isDeleted = true;
    record.deletedAt = new Date();
    await this.dataRepository.save(record);
  }

  // ============= Приватные методы =============

  /**
   * Получить коллекцию с проверкой доступа
   */
  private async getCollectionWithAccessCheck(
    apiKeyContext: ApiKeyContext,
    collectionName: string,
    userContext: PublicUserContext,
    action: "read" | "list" | "create" | "update" | "delete",
  ): Promise<CustomCollectionSchema> {
    const collection = await this.schemaRepository.findOne({
      where: {
        ownerId: apiKeyContext.ownerId,
        ownerType: apiKeyContext.ownerType,
        collectionName,
        isActive: true,
        isDeleted: false,
      },
    });

    if (!collection) {
      throw new NotFoundException("Коллекция не найдена");
    }

    if (!this.canAccessCollection(collection.accessSettings, userContext, action)) {
      throw new ForbiddenException(`Действие '${action}' запрещено для этой коллекции`);
    }

    return collection;
  }

  /**
   * Проверить, разрешено ли действие для коллекции
   */
  private canAccessCollection(
    settings: CollectionAccessSettings,
    userContext: PublicUserContext,
    action: "read" | "list" | "create" | "update" | "delete",
  ): boolean {
    if (userContext.isAuthenticated) {
      // Авторизованный пользователь
      switch (action) {
        case "read":
          return settings.authenticated.read;
        case "list":
          return settings.authenticated.list;
        case "create":
          return settings.authenticated.create;
        case "update":
          return settings.authenticated.update;
        case "delete":
          return settings.authenticated.delete;
      }
    } else {
      // Неавторизованный пользователь (public права)
      switch (action) {
        case "read":
          return settings.public.read;
        case "list":
          return settings.public.list;
        case "create":
          return settings.public.create;
        case "update":
          return settings.public.update;
        case "delete":
          return settings.public.delete;
      }
    }
  }

  /**
   * Оценить RLS правило для записи
   */
  private evaluateRlsRule(
    rule: string,
    record: CustomData,
    userContext: PublicUserContext,
  ): boolean {
    if (rule === "true") return true;
    if (rule === "false") return false;

    try {
      // Заменяем переменные на значения
      let expression = rule
        .replace(/@userId/g, userContext.userId ? `'${userContext.userId}'` : "null")
        .replace(/@userEmail/g, userContext.userEmail ? `'${userContext.userEmail}'` : "null")
        .replace(/@now/g, `'${new Date().toISOString()}'`);

      // Заменяем data.field на значения из записи
      expression = expression.replace(/data\.(\w+)/g, (_, field) => {
        const value = record.data?.[field];
        if (value === undefined || value === null) return "null";
        if (typeof value === "string") return `'${value}'`;
        return String(value);
      });

      // Преобразуем в JavaScript выражение
      expression = expression
        .replace(/\s*=\s*/g, " === ")
        .replace(/\s*<>\s*/g, " !== ")
        .replace(/\s+AND\s+/gi, " && ")
        .replace(/\s+OR\s+/gi, " || ");

      // Безопасно вычисляем (только простые сравнения)
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${expression}`)();
      return Boolean(result);
    } catch (error) {
      this.logger.warn(`Failed to evaluate RLS rule: ${rule}`, error);
      return false; // При ошибке запрещаем доступ
    }
  }

  /**
   * Построить SQL условие из RLS правила
   */
  private buildRlsCondition(
    rule: string,
    userContext: PublicUserContext,
  ): { sql: string; params: Record<string, any> } | null {
    if (rule === "true") return null;
    if (rule === "false") return { sql: "1 = 0", params: {} };

    try {
      const params: Record<string, any> = {};
      let sql = rule;

      // Заменяем @userId
      if (userContext.userId) {
        sql = sql.replace(/@userId/g, ":rlsUserId");
        params.rlsUserId = userContext.userId;
      } else {
        sql = sql.replace(/@userId/g, "null");
      }

      // Заменяем @userEmail
      if (userContext.userEmail) {
        sql = sql.replace(/@userEmail/g, ":rlsUserEmail");
        params.rlsUserEmail = userContext.userEmail;
      } else {
        sql = sql.replace(/@userEmail/g, "null");
      }

      // Заменяем @now
      sql = sql.replace(/@now/g, "NOW()");

      // Преобразуем data.field в JSON путь
      sql = sql.replace(/data\.(\w+)/g, "data.data->>'$1'");

      return { sql, params };
    } catch (error) {
      this.logger.warn(`Failed to build RLS condition: ${rule}`, error);
      return { sql: "1 = 0", params: {} }; // При ошибке запрещаем доступ
    }
  }

  /**
   * Построить SQL условие из пользовательского фильтра
   */
  private buildFilterCondition(
    filter: Record<string, any>,
  ): { sql: string; params: Record<string, any> } | null {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    Object.entries(filter).forEach(([field, value], index) => {
      const paramName = `filter_${index}`;
      conditions.push(`data.data->>'${field}' = :${paramName}`);
      params[paramName] = String(value);
    });

    if (conditions.length === 0) return null;

    return {
      sql: conditions.join(" AND "),
      params,
    };
  }

  /**
   * Генерировать уникальный ключ для записи
   */
  private generateKey(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
