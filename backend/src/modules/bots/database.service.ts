import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { Bot } from "../../database/entities/bot.entity";
import {
  BotCustomData,
  CustomDataType,
} from "../../database/entities/bot-custom-data.entity";
import { Message } from "../../database/entities/message.entity";
import { Lead } from "../../database/entities/lead.entity";
import { Product } from "../../database/entities/product.entity";
import { Specialist } from "../../database/entities/specialist.entity";
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
    const allowedTables = {
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
    };

    if (!allowedTables[table] || !allowedTables[table][operation]) {
      return {
        success: false,
        error: `Operation ${operation} not allowed on table ${table}`,
      };
    }

    const repositories = {
      messages: this.messageRepository,
      leads: this.leadRepository,
      products: this.productRepository,
      specialists: this.specialistRepository,
    };

    const repository = repositories[table];
    if (!repository) {
      return { success: false, error: `Table ${table} not found` };
    }

    let queryBuilder: SelectQueryBuilder<any>;

    switch (operation) {
      case "select":
        queryBuilder = repository
          .createQueryBuilder(table)
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          // Простая защита от SQL инъекций - только разрешенные операторы
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            queryBuilder.andWhere(sanitizedWhere);
          }
        }

        if (orderBy) {
          queryBuilder.orderBy(orderBy);
        }

        queryBuilder.limit(Math.min(limit, 1000)).offset(offset);

        const result = await queryBuilder.getMany();
        return { success: true, data: result, count: result.length };

      case "count":
        queryBuilder = repository
          .createQueryBuilder(table)
          .select(`COUNT(${table}.id)`, "count")
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            queryBuilder.andWhere(sanitizedWhere);
          }
        }

        const countResult = await queryBuilder.getRawOne();
        return { success: true, count: parseInt(countResult.count) || 0 };

      case "insert":
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

      case "update":
        if (!data) {
          return {
            success: false,
            error: "Data required for update operation",
          };
        }

        queryBuilder = repository
          .createQueryBuilder(table)
          .update()
          .set(data)
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            queryBuilder.andWhere(sanitizedWhere);
          }
        }

        const updateResult = await queryBuilder.execute();
        return { success: true, count: updateResult.affected };

      case "delete":
        queryBuilder = repository
          .createQueryBuilder(table)
          .delete()
          .where(`${table}.botId = :botId`, { botId });

        if (where) {
          const sanitizedWhere = this.sanitizeWhereClause(where);
          if (sanitizedWhere) {
            queryBuilder.andWhere(sanitizedWhere);
          }
        }

        const deleteResult = await queryBuilder.execute();
        return { success: true, count: deleteResult.affected };

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
      limit = 100,
      offset = 0,
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

        if (key) {
          queryBuilder.andWhere("custom.key = :key", { key });
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
          data: key ? mappedResults[0] : mappedResults,
          count: mappedResults.length,
        };

      case "insert":
      case "update":
        if (!data) {
          return {
            success: false,
            error: "Data required for insert/update operation",
          };
        }

        if (!key) {
          return {
            success: false,
            error: "Key required for custom storage operations",
          };
        }

        // Ищем существующую запись
        let existingRecord = await this.customDataRepository.findOne({
          where: { botId, collection, key },
        });

        if (existingRecord) {
          // Обновляем
          existingRecord.data = data;
          existingRecord.metadata =
            config.data?.metadata || existingRecord.metadata;
          await this.customDataRepository.save(existingRecord);
          return { success: true, data: existingRecord };
        } else {
          // Создаем новую
          const newRecord = this.customDataRepository.create({
            botId,
            collection,
            key,
            data,
            dataType: CustomDataType.JSON_TABLE,
            metadata: config.data?.metadata,
          });
          const savedRecord = await this.customDataRepository.save(newRecord);
          return { success: true, data: savedRecord };
        }

      case "delete":
        const deleteQuery = this.customDataRepository
          .createQueryBuilder("custom")
          .delete()
          .where("custom.botId = :botId", { botId })
          .andWhere("custom.collection = :collection", { collection });

        if (key) {
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

        if (key) {
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

    // Проверяем базовую структуру - должны быть только разрешенные символы
    const allowedPattern = /^[a-zA-Z0-9_\.\s=\<\>\!\+\-\(\)\'\"\&\|\s]+$/;
    if (!allowedPattern.test(where)) {
      this.logger.warn(`Invalid characters in where clause: ${where}`);
      return null;
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
    };
  }
}
