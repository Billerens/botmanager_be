import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, ILike } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import {
  CustomCollectionSchema,
  CustomDataOwnerType,
  FieldType,
  CollectionSchemaDefinition,
  FieldSchema,
  CollectionAccessSettings,
  RowLevelSecurityRules,
} from "../../database/entities/custom-collection-schema.entity";
import { CustomData } from "../../database/entities/custom-data.entity";
import { CustomLoggerService } from "../../common/logger.service";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  CreateDataDto,
  UpdateDataDto,
  PatchDataDto,
  FindDataQueryDto,
  AdvancedQueryDto,
  AggregateQueryDto,
  ImportDataDto,
} from "./dto";

@Injectable()
export class CustomDataService {
  constructor(
    @InjectRepository(CustomCollectionSchema)
    private readonly schemaRepo: Repository<CustomCollectionSchema>,
    @InjectRepository(CustomData)
    private readonly dataRepo: Repository<CustomData>,
    private readonly logger: CustomLoggerService,
  ) {}

  // ========================================================================
  // УПРАВЛЕНИЕ СХЕМАМИ КОЛЛЕКЦИЙ
  // ========================================================================

  /**
   * Создать новую коллекцию
   */
  async createCollection(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    dto: CreateCollectionDto,
  ): Promise<CustomCollectionSchema> {
    this.logger.log(`Creating collection "${dto.collectionName}" for ${ownerType}:${ownerId}`);

    // Проверяем уникальность имени
    const existing = await this.schemaRepo.findOne({
      where: { ownerId, ownerType, collectionName: dto.collectionName, isDeleted: false },
    });

    if (existing) {
      throw new ConflictException(`Collection "${dto.collectionName}" already exists`);
    }

    // Извлекаем индексируемые поля
    const indexedFields = this.extractIndexableFields(dto.schema);

    // Создаём коллекцию
    const collection = this.schemaRepo.create({
      ownerId,
      ownerType,
      collectionName: dto.collectionName,
      displayName: dto.displayName || dto.collectionName,
      description: dto.description,
      icon: dto.icon,
      schema: dto.schema,
      indexedFields,
      titleField: dto.titleField || this.detectTitleField(dto.schema),
      relations: dto.relations,
      uiSettings: dto.uiSettings,
    });

    return this.schemaRepo.save(collection);
  }

  /**
   * Получить список коллекций владельца
   */
  async getCollections(
    ownerId: string,
    ownerType: CustomDataOwnerType,
  ): Promise<CustomCollectionSchema[]> {
    return this.schemaRepo.find({
      where: { ownerId, ownerType, isDeleted: false },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Получить конкретную коллекцию
   */
  async getCollection(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
  ): Promise<CustomCollectionSchema> {
    const collection = await this.schemaRepo.findOne({
      where: { ownerId, ownerType, collectionName, isDeleted: false },
    });

    if (!collection) {
      throw new NotFoundException(`Collection "${collectionName}" not found`);
    }

    return collection;
  }

  /**
   * Обновить коллекцию
   */
  async updateCollection(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    dto: UpdateCollectionDto,
  ): Promise<CustomCollectionSchema> {
    const collection = await this.getCollection(ownerId, ownerType, collectionName);

    // Если обновляется схема - валидируем миграцию
    if (dto.schema) {
      this.validateSchemaMigration(collection.schema, dto.schema);
      collection.indexedFields = this.extractIndexableFields(dto.schema);
    }

    // Обновляем поля
    if (dto.displayName !== undefined) collection.displayName = dto.displayName;
    if (dto.description !== undefined) collection.description = dto.description;
    if (dto.icon !== undefined) collection.icon = dto.icon;
    if (dto.schema !== undefined) collection.schema = dto.schema;
    if (dto.titleField !== undefined) collection.titleField = dto.titleField;
    if (dto.relations !== undefined) collection.relations = dto.relations;
    if (dto.uiSettings !== undefined) collection.uiSettings = dto.uiSettings;
    if (dto.accessSettings !== undefined) {
      // Мержим с текущими значениями, заполняя недостающие поля
      collection.accessSettings = {
        public: {
          read: dto.accessSettings.public?.read ?? collection.accessSettings.public.read,
          list: dto.accessSettings.public?.list ?? collection.accessSettings.public.list,
          create: dto.accessSettings.public?.create ?? collection.accessSettings.public.create,
          update: dto.accessSettings.public?.update ?? collection.accessSettings.public.update,
          delete: dto.accessSettings.public?.delete ?? collection.accessSettings.public.delete,
        },
        authenticated: {
          read: dto.accessSettings.authenticated?.read ?? collection.accessSettings.authenticated.read,
          list: dto.accessSettings.authenticated?.list ?? collection.accessSettings.authenticated.list,
          create: dto.accessSettings.authenticated?.create ?? collection.accessSettings.authenticated.create,
          update: dto.accessSettings.authenticated?.update ?? collection.accessSettings.authenticated.update,
          delete: dto.accessSettings.authenticated?.delete ?? collection.accessSettings.authenticated.delete,
        },
      } as CollectionAccessSettings;
    }
    if (dto.rowLevelSecurity !== undefined) {
      // Мержим с текущими значениями, заполняя недостающие поля
      collection.rowLevelSecurity = {
        read: dto.rowLevelSecurity.read ?? collection.rowLevelSecurity.read,
        create: dto.rowLevelSecurity.create ?? collection.rowLevelSecurity.create,
        update: dto.rowLevelSecurity.update ?? collection.rowLevelSecurity.update,
        delete: dto.rowLevelSecurity.delete ?? collection.rowLevelSecurity.delete,
      } as RowLevelSecurityRules;
    }
    if (dto.isActive !== undefined) collection.isActive = dto.isActive;

    return this.schemaRepo.save(collection);
  }

  /**
   * Удалить коллекцию (мягкое удаление)
   */
  async deleteCollection(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    hardDelete = false,
  ): Promise<void> {
    const collection = await this.getCollection(ownerId, ownerType, collectionName);

    if (hardDelete) {
      // Удаляем все данные коллекции
      await this.dataRepo.delete({ ownerId, ownerType, collection: collectionName });
      await this.schemaRepo.delete(collection.id);
    } else {
      // Мягкое удаление
      collection.isDeleted = true;
      collection.deletedAt = new Date();
      await this.schemaRepo.save(collection);

      // Помечаем все данные как удалённые
      await this.dataRepo.update(
        { ownerId, ownerType, collection: collectionName },
        { isDeleted: true, deletedAt: new Date() },
      );
    }

    this.logger.log(`Collection "${collectionName}" deleted (hard: ${hardDelete})`);
  }

  // ========================================================================
  // CRUD ДЛЯ ДАННЫХ
  // ========================================================================

  /**
   * Создать запись
   */
  async createRecord(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    dto: CreateDataDto,
    userId?: string,
  ): Promise<CustomData> {
    // Получаем схему (опционально)
    let schema: CustomCollectionSchema | null = null;
    try {
      schema = await this.getCollection(ownerId, ownerType, collectionName);
    } catch (e) {
      // Коллекция может не иметь схемы
    }

    // Валидируем данные если есть схема
    if (schema) {
      this.validateData(dto.data, schema.schema);
    }

    // Генерируем или используем переданный ключ
    const key = dto.key || uuidv4();

    // Проверяем уникальность ключа
    const existing = await this.dataRepo.findOne({
      where: { ownerId, ownerType, collection: collectionName, key },
    });

    if (existing) {
      throw new ConflictException(`Record with key "${key}" already exists`);
    }

    // Извлекаем индексируемые данные
    const indexedData = schema
      ? this.extractIndexedData(dto.data, schema.indexedFields)
      : null;

    // Извлекаем title
    const title = schema?.titleField ? dto.data[schema.titleField] : null;

    // Создаём запись
    const record = this.dataRepo.create({
      ownerId,
      ownerType,
      collection: collectionName,
      schemaId: schema?.id,
      key,
      data: dto.data,
      indexedData,
      metadata: dto.metadata,
      title,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.dataRepo.save(record);
  }

  /**
   * Пакетное создание записей
   */
  async createBulkRecords(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    records: CreateDataDto[],
    userId?: string,
  ): Promise<{ created: number; errors: { key?: string; error: string }[] }> {
    const results = { created: 0, errors: [] as { key?: string; error: string }[] };

    for (const record of records) {
      try {
        await this.createRecord(ownerId, ownerType, collectionName, record, userId);
        results.created++;
      } catch (error) {
        results.errors.push({
          key: record.key,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Получить запись по ключу
   */
  async getRecord(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    key: string,
    includeDeleted = false,
  ): Promise<CustomData> {
    const where: any = { ownerId, ownerType, collection: collectionName, key };
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    const record = await this.dataRepo.findOne({ where });

    if (!record) {
      throw new NotFoundException(`Record with key "${key}" not found`);
    }

    return record;
  }

  /**
   * Получить список записей
   */
  async findRecords(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    query: FindDataQueryDto,
  ): Promise<{ data: CustomData[]; total: number; limit: number; offset: number; hasMore: boolean }> {
    const qb = this.dataRepo
      .createQueryBuilder("d")
      .where("d.ownerId = :ownerId", { ownerId })
      .andWhere("d.ownerType = :ownerType", { ownerType })
      .andWhere("d.collection = :collection", { collection: collectionName });

    // Фильтр по удалённым
    if (!query.includeDeleted) {
      qb.andWhere("d.isDeleted = false");
    }

    // Парсим и применяем фильтр
    if (query.filter) {
      try {
        const filter = JSON.parse(query.filter);
        this.applyFilter(qb, filter);
      } catch (e) {
        throw new BadRequestException("Invalid filter JSON");
      }
    }

    // Полнотекстовый поиск
    if (query.search) {
      qb.andWhere(
        "(d.title ILIKE :search OR d.data::text ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    // Получаем общее количество
    const total = await qb.getCount();

    // Сортировка
    if (query.sortBy) {
      const direction = query.sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";
      if (query.sortBy === "createdAt" || query.sortBy === "updatedAt" || query.sortBy === "key") {
        qb.orderBy(`d.${query.sortBy}`, direction);
      } else {
        // Сортировка по полю в data/indexedData
        qb.orderBy(`d.indexedData->>'${query.sortBy}'`, direction);
      }
    } else {
      qb.orderBy("d.createdAt", "DESC");
    }

    // Пагинация
    const limit = Math.min(query.limit || 50, 1000);
    const offset = query.offset || 0;
    qb.limit(limit).offset(offset);

    const data = await qb.getMany();

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Продвинутый запрос
   */
  async advancedQuery(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    query: AdvancedQueryDto,
  ): Promise<{ data: CustomData[]; total: number }> {
    const qb = this.dataRepo
      .createQueryBuilder("d")
      .where("d.ownerId = :ownerId", { ownerId })
      .andWhere("d.ownerType = :ownerType", { ownerType })
      .andWhere("d.collection = :collection", { collection: collectionName })
      .andWhere("d.isDeleted = false");

    // Применяем условия
    if (query.where?.length) {
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      query.where.forEach((condition, index) => {
        const paramName = `p${index}`;
        const fieldPath = `d.indexedData->>'${condition.field}'`;
        
        switch (condition.operator) {
          case "eq":
            conditions.push(`${fieldPath} = :${paramName}`);
            params[paramName] = String(condition.value);
            break;
          case "neq":
            conditions.push(`${fieldPath} != :${paramName}`);
            params[paramName] = String(condition.value);
            break;
          case "gt":
            conditions.push(`(${fieldPath})::numeric > :${paramName}`);
            params[paramName] = condition.value;
            break;
          case "gte":
            conditions.push(`(${fieldPath})::numeric >= :${paramName}`);
            params[paramName] = condition.value;
            break;
          case "lt":
            conditions.push(`(${fieldPath})::numeric < :${paramName}`);
            params[paramName] = condition.value;
            break;
          case "lte":
            conditions.push(`(${fieldPath})::numeric <= :${paramName}`);
            params[paramName] = condition.value;
            break;
          case "contains":
            conditions.push(`${fieldPath} ILIKE :${paramName}`);
            params[paramName] = `%${condition.value}%`;
            break;
          case "startsWith":
            conditions.push(`${fieldPath} ILIKE :${paramName}`);
            params[paramName] = `${condition.value}%`;
            break;
          case "endsWith":
            conditions.push(`${fieldPath} ILIKE :${paramName}`);
            params[paramName] = `%${condition.value}`;
            break;
          case "in":
            conditions.push(`${fieldPath} IN (:...${paramName})`);
            params[paramName] = condition.value;
            break;
          case "notIn":
            conditions.push(`${fieldPath} NOT IN (:...${paramName})`);
            params[paramName] = condition.value;
            break;
        }
      });

      const joinOperator = query.logic === "or" ? " OR " : " AND ";
      qb.andWhere(`(${conditions.join(joinOperator)})`, params);
    }

    // Получаем общее количество
    const total = await qb.getCount();

    // Сортировка
    if (query.orderBy?.length) {
      query.orderBy.forEach((order, index) => {
        const method = index === 0 ? "orderBy" : "addOrderBy";
        qb[method](`d.indexedData->>'${order.field}'`, order.direction.toUpperCase() as "ASC" | "DESC");
      });
    }

    // Пагинация
    qb.limit(query.limit || 50).offset(query.offset || 0);

    // Выбор полей (если указано)
    // Для JSONB это сложнее, пока возвращаем всё

    const data = await qb.getMany();

    return { data, total };
  }

  /**
   * Агрегация данных
   */
  async aggregate(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    query: AggregateQueryDto,
  ): Promise<any> {
    const qb = this.dataRepo
      .createQueryBuilder("d")
      .where("d.ownerId = :ownerId", { ownerId })
      .andWhere("d.ownerType = :ownerType", { ownerType })
      .andWhere("d.collection = :collection", { collection: collectionName })
      .andWhere("d.isDeleted = false");

    // Применяем фильтр
    if (query.filter) {
      try {
        const filter = JSON.parse(query.filter);
        this.applyFilter(qb, filter);
      } catch (e) {
        throw new BadRequestException("Invalid filter JSON");
      }
    }

    const fieldPath = query.field === "id" ? "d.id" : `d.indexedData->>'${query.field}'`;

    switch (query.operation) {
      case "count":
        return { result: await qb.getCount() };
      case "countDistinct":
        const distinctResult = await qb
          .select(`COUNT(DISTINCT ${fieldPath})`, "result")
          .getRawOne();
        return { result: parseInt(distinctResult.result) || 0 };
      case "sum":
        const sumResult = await qb
          .select(`SUM((${fieldPath})::numeric)`, "result")
          .getRawOne();
        return { result: parseFloat(sumResult.result) || 0 };
      case "avg":
        const avgResult = await qb
          .select(`AVG((${fieldPath})::numeric)`, "result")
          .getRawOne();
        return { result: parseFloat(avgResult.result) || 0 };
      case "min":
        const minResult = await qb
          .select(`MIN((${fieldPath})::numeric)`, "result")
          .getRawOne();
        return { result: parseFloat(minResult.result) || null };
      case "max":
        const maxResult = await qb
          .select(`MAX((${fieldPath})::numeric)`, "result")
          .getRawOne();
        return { result: parseFloat(maxResult.result) || null };
      default:
        throw new BadRequestException(`Unknown aggregation operation: ${query.operation}`);
    }
  }

  /**
   * Обновить запись
   */
  async updateRecord(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    key: string,
    dto: UpdateDataDto,
    userId?: string,
  ): Promise<CustomData> {
    const record = await this.getRecord(ownerId, ownerType, collectionName, key);

    // Получаем схему
    let schema: CustomCollectionSchema | null = null;
    try {
      schema = await this.getCollection(ownerId, ownerType, collectionName);
    } catch (e) {
      // Без схемы
    }

    // Валидируем
    if (schema) {
      this.validateData(dto.data, schema.schema);
    }

    // Обновляем
    record.data = dto.data;
    record.indexedData = schema
      ? this.extractIndexedData(dto.data, schema.indexedFields)
      : null;
    record.title = schema?.titleField ? dto.data[schema.titleField] : null;
    record.metadata = dto.metadata ?? record.metadata;
    record.version += 1;
    record.updatedBy = userId;

    return this.dataRepo.save(record);
  }

  /**
   * Частичное обновление записи
   */
  async patchRecord(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    key: string,
    dto: PatchDataDto,
    userId?: string,
  ): Promise<CustomData> {
    const record = await this.getRecord(ownerId, ownerType, collectionName, key);

    // Получаем схему
    let schema: CustomCollectionSchema | null = null;
    try {
      schema = await this.getCollection(ownerId, ownerType, collectionName);
    } catch (e) {
      // Без схемы
    }

    // Мержим данные
    if (dto.data) {
      record.data = { ...record.data, ...dto.data };
    }
    if (dto.metadata) {
      record.metadata = { ...(record.metadata || {}), ...dto.metadata };
    }

    // Валидируем
    if (schema) {
      this.validateData(record.data, schema.schema);
      record.indexedData = this.extractIndexedData(record.data, schema.indexedFields);
      record.title = schema.titleField ? record.data[schema.titleField] : null;
    }

    record.version += 1;
    record.updatedBy = userId;

    return this.dataRepo.save(record);
  }

  /**
   * Удалить запись
   */
  async deleteRecord(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    key: string,
    hardDelete = false,
  ): Promise<void> {
    const record = await this.getRecord(ownerId, ownerType, collectionName, key, true);

    if (hardDelete) {
      await this.dataRepo.delete(record.id);
    } else {
      record.isDeleted = true;
      record.deletedAt = new Date();
      await this.dataRepo.save(record);
    }
  }

  /**
   * Пакетное удаление записей
   */
  async deleteBulkRecords(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    keys: string[],
    hardDelete = false,
  ): Promise<{ deleted: number }> {
    if (hardDelete) {
      const result = await this.dataRepo.delete({
        ownerId,
        ownerType,
        collection: collectionName,
        key: In(keys),
      });
      return { deleted: result.affected || 0 };
    } else {
      const result = await this.dataRepo.update(
        {
          ownerId,
          ownerType,
          collection: collectionName,
          key: In(keys),
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
        },
      );
      return { deleted: result.affected || 0 };
    }
  }

  /**
   * Импорт данных
   */
  async importData(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
    dto: ImportDataDto,
    userId?: string,
  ): Promise<{ imported: number; skipped: number; updated: number; errors: any[] }> {
    const results = { imported: 0, skipped: 0, updated: 0, errors: [] as any[] };

    for (const record of dto.records) {
      try {
        const key = dto.keyField ? record[dto.keyField] : uuidv4();

        // Проверяем существование
        const existing = await this.dataRepo.findOne({
          where: { ownerId, ownerType, collection: collectionName, key },
        });

        if (existing) {
          switch (dto.onConflict) {
            case "skip":
              results.skipped++;
              continue;
            case "update":
              await this.updateRecord(ownerId, ownerType, collectionName, key, { data: record }, userId);
              results.updated++;
              continue;
            case "error":
            default:
              throw new Error(`Record with key "${key}" already exists`);
          }
        }

        await this.createRecord(ownerId, ownerType, collectionName, { key, data: record }, userId);
        results.imported++;
      } catch (error) {
        results.errors.push({ record, error: error.message });
      }
    }

    return results;
  }

  // ========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ========================================================================

  /**
   * Валидация данных по схеме
   */
  private validateData(data: Record<string, any>, schema: CollectionSchemaDefinition): void {
    const errors: string[] = [];

    // Проверяем обязательные поля
    for (const requiredField of schema.required || []) {
      if (data[requiredField] === undefined || data[requiredField] === null) {
        errors.push(`Field "${requiredField}" is required`);
      }
    }

    // Проверяем типы и ограничения
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const value = data[fieldName];

      if (value === undefined || value === null) continue;

      // Проверка типа
      if (!this.checkType(value, fieldSchema.type)) {
        errors.push(`Field "${fieldName}" must be of type ${fieldSchema.type}`);
        continue;
      }

      // Проверки для строк
      if (fieldSchema.type === FieldType.STRING || fieldSchema.type === FieldType.TEXT) {
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push(`Field "${fieldName}" must have at least ${fieldSchema.minLength} characters`);
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push(`Field "${fieldName}" must have at most ${fieldSchema.maxLength} characters`);
        }
        if (fieldSchema.pattern) {
          const regex = new RegExp(fieldSchema.pattern);
          if (!regex.test(value)) {
            errors.push(`Field "${fieldName}" doesn't match pattern ${fieldSchema.pattern}`);
          }
        }
      }

      // Проверки для чисел
      if (fieldSchema.type === FieldType.NUMBER) {
        if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
          errors.push(`Field "${fieldName}" must be >= ${fieldSchema.minimum}`);
        }
        if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
          errors.push(`Field "${fieldName}" must be <= ${fieldSchema.maximum}`);
        }
      }

      // Проверка enum (select/multiselect)
      if (fieldSchema.options?.length) {
        const validValues = fieldSchema.options.map(o => o.value);
        if (fieldSchema.type === FieldType.MULTISELECT) {
          if (!Array.isArray(value) || !value.every(v => validValues.includes(v))) {
            errors.push(`Field "${fieldName}" contains invalid options`);
          }
        } else if (!validValues.includes(value)) {
          errors.push(`Field "${fieldName}" must be one of: ${validValues.join(", ")}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: "Validation failed", errors });
    }
  }

  /**
   * Проверка типа значения
   */
  private checkType(value: any, type: FieldType): boolean {
    switch (type) {
      case FieldType.STRING:
      case FieldType.TEXT:
      case FieldType.EMAIL:
      case FieldType.URL:
      case FieldType.PHONE:
      case FieldType.FILE:
      case FieldType.IMAGE:
      case FieldType.SELECT:
        return typeof value === "string";
      case FieldType.NUMBER:
        return typeof value === "number" && !isNaN(value);
      case FieldType.BOOLEAN:
        return typeof value === "boolean";
      case FieldType.DATE:
        return typeof value === "string" || value instanceof Date;
      case FieldType.ARRAY:
      case FieldType.MULTISELECT:
        return Array.isArray(value);
      case FieldType.OBJECT:
        return typeof value === "object" && value !== null && !Array.isArray(value);
      case FieldType.RELATION:
        return typeof value === "string"; // ID связанной записи
      default:
        return true;
    }
  }

  /**
   * Извлечь индексируемые поля из схемы
   */
  private extractIndexableFields(schema: CollectionSchemaDefinition): string[] {
    const indexableTypes: FieldType[] = [
      FieldType.STRING,
      FieldType.NUMBER,
      FieldType.BOOLEAN,
      FieldType.DATE,
      FieldType.SELECT,
      FieldType.EMAIL,
      FieldType.PHONE,
      FieldType.RELATION,
    ];

    return Object.entries(schema.properties)
      .filter(([_, fieldSchema]) => indexableTypes.includes(fieldSchema.type))
      .map(([fieldName]) => fieldName);
  }

  /**
   * Извлечь индексируемые данные из записи
   */
  private extractIndexedData(
    data: Record<string, any>,
    indexedFields: string[],
  ): Record<string, any> {
    const indexed: Record<string, any> = {};
    for (const field of indexedFields) {
      if (data[field] !== undefined) {
        indexed[field] = data[field];
      }
    }
    return indexed;
  }

  /**
   * Определить поле для title
   */
  private detectTitleField(schema: CollectionSchemaDefinition): string | undefined {
    const priorityNames = ["name", "title", "label", "displayName", "subject"];
    
    for (const name of priorityNames) {
      if (schema.properties[name]) {
        return name;
      }
    }

    // Первое строковое поле
    const firstStringField = Object.entries(schema.properties).find(
      ([_, fieldSchema]) => fieldSchema.type === FieldType.STRING,
    );

    return firstStringField?.[0];
  }

  /**
   * Валидация миграции схемы
   */
  private validateSchemaMigration(
    oldSchema: CollectionSchemaDefinition,
    newSchema: CollectionSchemaDefinition,
  ): void {
    // Проверяем, что обязательные поля не удаляются
    const oldRequired = new Set(oldSchema.required || []);
    const newFields = new Set(Object.keys(newSchema.properties));

    for (const field of oldRequired) {
      if (!newFields.has(field)) {
        throw new BadRequestException(
          `Cannot remove required field "${field}". Make it optional first.`,
        );
      }
    }

    // Проверяем совместимость типов
    for (const [fieldName, oldFieldSchema] of Object.entries(oldSchema.properties)) {
      const newFieldSchema = newSchema.properties[fieldName];
      if (newFieldSchema && oldFieldSchema.type !== newFieldSchema.type) {
        this.logger.warn(
          `Field "${fieldName}" type changed from ${oldFieldSchema.type} to ${newFieldSchema.type}`,
        );
        // Можно добавить строгую проверку или миграцию данных
      }
    }
  }

  /**
   * Применить фильтр к query builder
   */
  private applyFilter(qb: any, filter: Record<string, any>): void {
    Object.entries(filter).forEach(([field, value], index) => {
      const paramName = `filter${index}`;
      qb.andWhere(`d.indexedData->>'${field}' = :${paramName}`, {
        [paramName]: String(value),
      });
    });
  }

  /**
   * Получить статистику коллекции
   */
  async getCollectionStats(
    ownerId: string,
    ownerType: CustomDataOwnerType,
    collectionName: string,
  ): Promise<{
    totalRecords: number;
    activeRecords: number;
    deletedRecords: number;
    lastUpdated: Date | null;
  }> {
    const [totalRecords, activeRecords, lastRecord] = await Promise.all([
      this.dataRepo.count({
        where: { ownerId, ownerType, collection: collectionName },
      }),
      this.dataRepo.count({
        where: { ownerId, ownerType, collection: collectionName, isDeleted: false },
      }),
      this.dataRepo.findOne({
        where: { ownerId, ownerType, collection: collectionName },
        order: { updatedAt: "DESC" },
      }),
    ]);

    return {
      totalRecords,
      activeRecords,
      deletedRecords: totalRecords - activeRecords,
      lastUpdated: lastRecord?.updatedAt || null,
    };
  }
}
