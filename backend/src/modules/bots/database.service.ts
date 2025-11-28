import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Bot } from "../../database/entities/bot.entity";
import {
  BotCustomData,
  CustomDataType,
} from "../../database/entities/bot-custom-data.entity";
import { Message } from "../../database/entities/message.entity";
import { Lead } from "../../database/entities/lead.entity";
import { Product } from "../../database/entities/product.entity";
import { Specialist } from "../../database/entities/specialist.entity";
import { Category } from "../../database/entities/category.entity";
import { Order } from "../../database/entities/order.entity";
import { Service } from "../../database/entities/service.entity";
import { Booking } from "../../database/entities/booking.entity";
import { Cart } from "../../database/entities/cart.entity";
import { ShopPromocode } from "../../database/entities/shop-promocode.entity";
import { TimeSlot } from "../../database/entities/time-slot.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { CustomLoggerService } from "../../common/logger.service";

export interface DatabaseQueryConfig {
  dataSource: "bot_data" | "custom_storage";
  table?: string;
  collection?: string;
  operation: "select" | "insert" | "update" | "delete" | "count";
  where?: string;
  data?: any;
  limit?: number;
  offset?: number;
  orderBy?: string;
  key?: string; // для custom_storage
}

export interface DatabaseQueryResult {
  success: boolean;
  data?: any;
  count?: number;
  error?: string;
}

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(BotCustomData)
    private readonly customDataRepository: Repository<BotCustomData>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Specialist)
    private readonly specialistRepository: Repository<Specialist>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(ShopPromocode)
    private readonly promocodeRepository: Repository<ShopPromocode>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    private readonly logger: CustomLoggerService
  ) {}

  async executeQuery(
    botId: string,
    config: DatabaseQueryConfig
  ): Promise<DatabaseQueryResult> {
    try {
      this.logger.log(`Database query: ${JSON.stringify(config)}`);

      switch (config.dataSource) {
        case "bot_data":
          return await this.executeBotDataQuery(botId, config);
        case "custom_storage":
          return await this.executeCustomStorageQuery(botId, config);
        default:
          return { success: false, error: "Unsupported data source" };
      }
    } catch (error) {
      this.logger.error("Database query error:", error);
      return { success: false, error: error.message };
    }
  }

  private async executeBotDataQuery(
    botId: string,
    config: DatabaseQueryConfig
  ): Promise<DatabaseQueryResult> {
    const {
      table,
      operation,
      where,
      data,
      limit = 100,
      offset = 0,
      orderBy,
    } = config;

    // Проверяем разрешения для таблиц
    const allowedTables: Record<string, Record<string, boolean>> = {
      messages: { select: true, count: true },
      leads: { select: true, insert: true, update: true, count: true },
      products: {
        select: true,
        insert: true,
        update: true,
        delete: true,
        count: true,
      },
      specialists: { select: true, insert: true, update: true, count: true },
      categories: {
        select: true,
        insert: true,
        update: true,
        delete: true,
        count: true,
      },
      orders: { select: true, insert: true, update: true, count: true },
      services: {
        select: true,
        insert: true,
        update: true,
        delete: true,
        count: true,
      },
      bookings: { select: true, insert: true, update: true, count: true },
      carts: { select: true, update: true, count: true },
      promocodes: {
        select: true,
        insert: true,
        update: true,
        delete: true,
        count: true,
      },
      time_slots: { select: true, insert: true, update: true, count: true },
      custom_pages: { select: true, count: true },
    };

    if (!allowedTables[table] || !allowedTables[table][operation]) {
      return {
        success: false,
        error: `Operation ${operation} not allowed on table ${table}`,
      };
    }

    const repositories: Record<string, Repository<any>> = {
      messages: this.messageRepository,
      leads: this.leadRepository,
      products: this.productRepository,
      specialists: this.specialistRepository,
      categories: this.categoryRepository,
      orders: this.orderRepository,
      services: this.serviceRepository,
      bookings: this.bookingRepository,
      carts: this.cartRepository,
      promocodes: this.promocodeRepository,
      time_slots: this.timeSlotRepository,
      custom_pages: this.customPageRepository,
    };

    const repository = repositories[table];
    if (!repository) {
      return { success: false, error: `Table ${table} not found` };
    }

    switch (operation) {
      case "select": {
        const selectQuery = repository
          .createQueryBuilder(table)
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          // Простая защита от SQL инъекций - только разрешенные операторы
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            selectQuery.andWhere(sanitizedWhere);
          }
        }

        if (orderBy) {
          selectQuery.orderBy(orderBy);
        }

        selectQuery.limit(Math.min(limit, 1000)).offset(offset);

        const result = await selectQuery.getMany();
        return { success: true, data: result, count: result.length };
      }

      case "count": {
        const countQuery = repository
          .createQueryBuilder(table)
          .select(`COUNT(${table}.id)`, "count")
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            countQuery.andWhere(sanitizedWhere);
          }
        }

        const countResult = await countQuery.getRawOne();
        return { success: true, count: parseInt(countResult.count) || 0 };
      }

      case "insert": {
        if (!data) {
          return {
            success: false,
            error: "Data required for insert operation",
          };
        }

        const insertData = { ...data, botId };
        const newEntity = repository.create(insertData);
        const savedEntity = await repository.save(newEntity);
        return { success: true, data: savedEntity };
      }

      case "update": {
        if (!data) {
          return {
            success: false,
            error: "Data required for update operation",
          };
        }

        const updateQuery = repository
          .createQueryBuilder(table)
          .update()
          .set(data)
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            updateQuery.andWhere(sanitizedWhere);
          }
        }

        const updateResult = await updateQuery.execute();
        return { success: true, count: updateResult.affected };
      }

      case "delete": {
        const deleteQuery = repository
          .createQueryBuilder(table)
          .delete()
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            deleteQuery.andWhere(sanitizedWhere);
          }
        }

        const deleteResult = await deleteQuery.execute();
        return { success: true, count: deleteResult.affected };
      }

      default:
        return { success: false, error: "Unsupported operation" };
    }
  }

  private async executeCustomStorageQuery(
    botId: string,
    config: DatabaseQueryConfig
  ): Promise<DatabaseQueryResult> {
    const {
      collection,
      operation,
      key,
      data,
      where,
      limit = 100,
      offset = 0,
      orderBy,
    } = config;

    if (!collection) {
      return {
        success: false,
        error: "Collection name required for custom storage",
      };
    }

    switch (operation) {
      case "select":
        const queryBuilder = this.customDataRepository
          .createQueryBuilder("custom")
          .where("custom.botId = :botId", { botId })
          .andWhere("custom.collection = :collection", { collection });

        // Если указан where, используем его для поиска по key (поддерживает ILIKE)
        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            // Пытаемся извлечь паттерн для ILIKE/LIKE и использовать параметризованный запрос
            const likeMatch = sanitizedWhere.match(
              /^\s*key\s+(ILIKE|LIKE)\s+(['"])([^'"]*)\2\s*$/i
            );
            if (likeMatch) {
              const pattern = likeMatch[3];
              const operator = likeMatch[1].toUpperCase();
              queryBuilder.andWhere(`custom.key ${operator} :keyPattern`, {
                keyPattern: pattern,
              });
            } else {
              // Для других условий заменяем "key" на "custom.key" и используем как есть
              // (переменные уже подставлены в database-node.handler.ts)
              const keyWhere = sanitizedWhere.replace(
                /\bkey\b/gi,
                "custom.key"
              );
              queryBuilder.andWhere(keyWhere);
            }
          }
        } else if (key) {
          // Если where не указан, но есть key - используем точное совпадение
          queryBuilder.andWhere("custom.key = :key", { key });
        }

        if (orderBy) {
          // Заменяем "key" на "custom.key" в orderBy
          const keyOrderBy = orderBy.replace(/\bkey\b/gi, "custom.key");
          queryBuilder.orderBy(keyOrderBy);
        }

        queryBuilder.limit(Math.min(limit, 1000)).offset(offset);

        const results = await queryBuilder.getMany();
        const mappedResults = results.map((item) => ({
          key: item.key,
          data: item.data,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));

        return {
          success: true,
          data: mappedResults,
          count: mappedResults.length,
        };

      case "insert":
        if (!data) {
          return {
            success: false,
            error: "Data required for insert operation",
          };
        }

        if (!key) {
          return {
            success: false,
            error: "Key required for custom storage operations",
          };
        }

        // Для insert всегда создаем новую запись
        // Если запись с таким key уже существует, генерируем уникальный под-ключ
        let finalKey = key;
        let baseRecord = await this.customDataRepository.findOne({
          where: { botId, collection, key: finalKey },
        });

        if (baseRecord) {
          // Базовая запись существует - используем metadata.lastIndex для генерации под-ключа
          // lastIndex хранит последний использованный индекс под-ключа
          // Если lastIndex = 0, то следующая запись будет item_1
          const lastIndex = (baseRecord.metadata?.lastIndex as number) ?? 0;
          const newIndex = lastIndex + 1;
          finalKey = `${key}_item_${newIndex}`;

          // Обновляем lastIndex в базовой записи (никогда не уменьшается)
          const updatedMetadata = {
            ...(baseRecord.metadata || {}),
            lastIndex: newIndex,
          };
          baseRecord.metadata = updatedMetadata;
          await this.customDataRepository.save(baseRecord);

          this.logger.log(
            `Key "${key}" already exists, using generated key: "${finalKey}" (lastIndex: ${newIndex})`
          );
        } else {
          // Базовая запись не существует - проверяем, есть ли под-записи
          // (могли остаться после удаления базовой записи)
          const existingSubKeys = await this.customDataRepository.find({
            where: {
              botId,
              collection,
            },
          });

          // Ищем максимальный индекс среди существующих под-записей с таким паттерном
          const subKeyPattern = new RegExp(
            `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_item_(\\d+)$`
          );
          let maxIndex = 0;

          for (const record of existingSubKeys) {
            if (record.key && subKeyPattern.test(record.key)) {
              const match = record.key.match(subKeyPattern);
              if (match) {
                const index = parseInt(match[1], 10);
                if (index > maxIndex) {
                  maxIndex = index;
                }
              }
            }
          }

          if (maxIndex > 0) {
            // Найдены под-записи - создаем базовую запись с lastIndex = maxIndex
            // и следующая запись будет иметь индекс maxIndex + 1
            const baseMetadata = {
              ...(config.data?.metadata || {}),
              lastIndex: maxIndex,
            };

            const newBaseRecord = this.customDataRepository.create({
              botId,
              collection,
              key: finalKey,
              data,
              dataType: CustomDataType.JSON_TABLE,
              metadata: baseMetadata,
            });
            const savedBaseRecord =
              await this.customDataRepository.save(newBaseRecord);
            this.logger.log(
              `Base record "${key}" recreated with lastIndex=${maxIndex} (found existing sub-keys)`
            );
            return { success: true, data: savedBaseRecord };
          } else {
            // Под-записей нет - создаем базовую запись с metadata.lastIndex = 0
            const baseMetadata = {
              ...(config.data?.metadata || {}),
              lastIndex: 0,
            };

            const newBaseRecord = this.customDataRepository.create({
              botId,
              collection,
              key: finalKey,
              data,
              dataType: CustomDataType.JSON_TABLE,
              metadata: baseMetadata,
            });
            const savedBaseRecord =
              await this.customDataRepository.save(newBaseRecord);
            return { success: true, data: savedBaseRecord };
          }
        }

        // Создаем новую запись с финальным ключом (под-ключ)
        const newRecord = this.customDataRepository.create({
          botId,
          collection,
          key: finalKey,
          data,
          dataType: CustomDataType.JSON_TABLE,
          metadata: config.data?.metadata,
        });
        const savedRecord = await this.customDataRepository.save(newRecord);
        return { success: true, data: savedRecord };

      case "update":
        if (!data) {
          return {
            success: false,
            error: "Data required for update operation",
          };
        }

        if (!key) {
          return {
            success: false,
            error: "Key required for custom storage operations",
          };
        }

        // Ищем существующую запись
        let existingRecordForUpdate = await this.customDataRepository.findOne({
          where: { botId, collection, key },
        });

        if (existingRecordForUpdate) {
          // Обновляем
          existingRecordForUpdate.data = data;
          existingRecordForUpdate.metadata =
            config.data?.metadata || existingRecordForUpdate.metadata;
          await this.customDataRepository.save(existingRecordForUpdate);
          return { success: true, data: existingRecordForUpdate };
        } else {
          // Запись не найдена - возвращаем ошибку для update
          return {
            success: false,
            error: `Record with key "${key}" not found. Use insert to create new records.`,
          };
        }

      case "delete":
        const deleteQuery = this.customDataRepository
          .createQueryBuilder("custom")
          .delete()
          .where("custom.botId = :botId", { botId })
          .andWhere("custom.collection = :collection", { collection });

        // Если указан where, используем его для поиска по key (поддерживает ILIKE)
        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            // Пытаемся извлечь паттерн для ILIKE/LIKE и использовать параметризованный запрос
            const likeMatch = sanitizedWhere.match(
              /^\s*key\s+(ILIKE|LIKE)\s+(['"])([^'"]*)\2\s*$/i
            );
            if (likeMatch) {
              const pattern = likeMatch[3];
              const operator = likeMatch[1].toUpperCase();
              deleteQuery.andWhere(`custom.key ${operator} :keyPattern`, {
                keyPattern: pattern,
              });
            } else {
              // Для других условий заменяем "key" на "custom.key" и используем как есть
              const keyWhere = sanitizedWhere.replace(
                /\bkey\b/gi,
                "custom.key"
              );
              deleteQuery.andWhere(keyWhere);
            }
          }
        } else if (key) {
          // Если where не указан, но есть key - используем точное совпадение
          deleteQuery.andWhere("custom.key = :key", { key });
        }

        const deleteResult = await deleteQuery.execute();
        return { success: true, count: deleteResult.affected };

      case "count":
        const countQuery = this.customDataRepository
          .createQueryBuilder("custom")
          .select("COUNT(custom.id)", "count")
          .where("custom.botId = :botId", { botId })
          .andWhere("custom.collection = :collection", { collection });

        // Если указан where, используем его для поиска по key (поддерживает ILIKE)
        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            // Пытаемся извлечь паттерн для ILIKE/LIKE и использовать параметризованный запрос
            const likeMatch = sanitizedWhere.match(
              /^\s*key\s+(ILIKE|LIKE)\s+(['"])([^'"]*)\2\s*$/i
            );
            if (likeMatch) {
              const pattern = likeMatch[3];
              const operator = likeMatch[1].toUpperCase();
              countQuery.andWhere(`custom.key ${operator} :keyPattern`, {
                keyPattern: pattern,
              });
            } else {
              // Для других условий заменяем "key" на "custom.key" и используем как есть
              const keyWhere = sanitizedWhere.replace(
                /\bkey\b/gi,
                "custom.key"
              );
              countQuery.andWhere(keyWhere);
            }
          }
        } else if (key) {
          // Если where не указан, но есть key - используем точное совпадение
          countQuery.andWhere("custom.key = :key", { key });
        }

        const countResult = await countQuery.getRawOne();
        return { success: true, count: parseInt(countResult.count) || 0 };

      default:
        return {
          success: false,
          error: "Unsupported operation for custom storage",
        };
    }
  }

  private sanitizeWhereClause(where: string): string | null {
    if (!where) return null;

    // Разрешаем только безопасные конструкции
    // Блокируем опасные ключевые слова
    const dangerousKeywords = [
      "drop",
      "alter",
      "create",
      "truncate",
      "exec",
      "execute",
      "--",
      "/*",
      "*/",
    ];
    const lowerWhere = where.toLowerCase();

    for (const keyword of dangerousKeywords) {
      if (lowerWhere.includes(keyword)) {
        this.logger.warn(
          `Dangerous keyword detected in where clause: ${keyword}`
        );
        return null;
      }
    }

    // Проверяем базовую структуру - разрешаем ILIKE, LIKE, %, _ для паттернов
    // Разрешаем: буквы, цифры, точки, пробелы, операторы сравнения, кавычки, скобки, ILIKE, LIKE, %, _
    const allowedPattern = /^[a-zA-Z0-9_\.\s=\<\>\!\+\-\(\)\'\"\&\|\%\s]+$/i;
    if (!allowedPattern.test(where)) {
      this.logger.warn(`Invalid characters in where clause: ${where}`);
      return null;
    }

    // Проверяем, что ILIKE и LIKE используются правильно (не в опасных конструкциях)
    const likePattern = /\b(ILIKE|LIKE)\s+['"]/i;
    if (likePattern.test(where)) {
      // Проверяем, что после ILIKE/LIKE идет строка с паттерном
      const likeMatch = where.match(/\b(ILIKE|LIKE)\s+(['"])([^'"]*)\2/i);
      if (likeMatch) {
        // Паттерн должен содержать только безопасные символы
        const pattern = likeMatch[3];
        const patternAllowed = /^[a-zA-Z0-9_\.\s\%\_\-]+$/;
        if (!patternAllowed.test(pattern)) {
          this.logger.warn(`Invalid pattern in ILIKE/LIKE: ${pattern}`);
          return null;
        }
      }
    }

    return where;
  }

  // Метод для получения доступных таблиц и их полей
  getAvailableTables(): Record<string, string[]> {
    return {
      messages: [
        "id",
        "telegramChatId",
        "text",
        "type",
        "createdAt",
        "metadata",
      ],
      leads: [
        "id",
        "name",
        "phone",
        "email",
        "status",
        "createdAt",
        "metadata",
      ],
      products: [
        "id",
        "name",
        "description",
        "price",
        "isActive",
        "categoryId",
        "createdAt",
      ],
      specialists: [
        "id",
        "name",
        "description",
        "phone",
        "email",
        "isActive",
        "createdAt",
      ],
      categories: [
        "id",
        "name",
        "description",
        "imageUrl",
        "isActive",
        "sortOrder",
        "parentId",
        "createdAt",
      ],
      orders: [
        "id",
        "telegramUsername",
        "items",
        "customerData",
        "additionalMessage",
        "status",
        "totalPrice",
        "currency",
        "appliedPromocodeId",
        "promocodeDiscount",
        "createdAt",
      ],
      services: [
        "id",
        "name",
        "description",
        "imageUrl",
        "price",
        "duration",
        "isActive",
        "category",
        "requirements",
        "notes",
        "createdAt",
      ],
      bookings: [
        "id",
        "clientName",
        "clientPhone",
        "clientEmail",
        "telegramUserId",
        "telegramUsername",
        "notes",
        "status",
        "source",
        "specialistId",
        "serviceId",
        "timeSlotId",
        "createdAt",
      ],
      carts: [
        "id",
        "telegramUsername",
        "items",
        "appliedPromocodeId",
        "createdAt",
        "updatedAt",
      ],
      promocodes: [
        "id",
        "code",
        "type",
        "value",
        "applicableTo",
        "categoryId",
        "productId",
        "usageLimit",
        "maxUsageCount",
        "currentUsageCount",
        "isActive",
        "validFrom",
        "validUntil",
        "createdAt",
      ],
      time_slots: [
        "id",
        "startTime",
        "endTime",
        "isAvailable",
        "isBooked",
        "specialistId",
        "metadata",
        "createdAt",
      ],
      custom_pages: [
        "id",
        "title",
        "slug",
        "description",
        "pageType",
        "content",
        "status",
        "isWebAppOnly",
        "botCommand",
        "createdAt",
      ],
    };
  }
}
