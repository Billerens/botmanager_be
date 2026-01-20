import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CustomDataOwnerType } from "../../../database/entities/custom-collection-schema.entity";

/**
 * DTO для создания записи
 */
export class CreateDataDto {
  @ApiPropertyOptional({ description: "Уникальный ключ записи (если не указан - генерируется автоматически)" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  key?: string;

  @ApiProperty({ description: "Данные записи", type: "object" })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: "Метаданные записи" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO для пакетного создания записей
 */
export class CreateBulkDataDto {
  @ApiProperty({ description: "Массив записей для создания", type: [CreateDataDto] })
  @IsArray()
  @Type(() => CreateDataDto)
  records: CreateDataDto[];
}

/**
 * DTO для обновления записи
 */
export class UpdateDataDto {
  @ApiProperty({ description: "Данные записи", type: "object" })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: "Метаданные записи" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO для частичного обновления записи
 */
export class PatchDataDto {
  @ApiPropertyOptional({ description: "Частичные данные для обновления", type: "object" })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: "Частичные метаданные для обновления" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO для параметров запроса списка
 */
export class FindDataQueryDto {
  @ApiPropertyOptional({ description: "Фильтр (JSON объект)", example: '{"status":"active"}' })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({ description: "Поиск по всем текстовым полям" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ description: "Лимит записей", default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: "Смещение", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: "Поле сортировки" })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], description: "Направление сортировки", default: "desc" })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc" = "desc";

  @ApiPropertyOptional({ description: "Включить удалённые записи", default: false })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeDeleted?: boolean = false;
}

/**
 * DTO для продвинутого запроса
 */
export class AdvancedQueryDto {
  @ApiPropertyOptional({ description: "Условия фильтрации", type: "array" })
  @IsOptional()
  @IsArray()
  where?: {
    field: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith" | "in" | "notIn";
    value: any;
  }[];

  @ApiPropertyOptional({ description: "Логический оператор для условий", enum: ["and", "or"], default: "and" })
  @IsOptional()
  @IsString()
  logic?: "and" | "or" = "and";

  @ApiPropertyOptional({ description: "Сортировка", type: "array" })
  @IsOptional()
  @IsArray()
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  }[];

  @ApiPropertyOptional({ description: "Лимит", default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: "Смещение", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: "Выбрать только определённые поля" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  select?: string[];
}

/**
 * DTO для агрегации
 */
export class AggregateQueryDto {
  @ApiProperty({ description: "Поле для агрегации" })
  @IsString()
  field: string;

  @ApiProperty({ 
    enum: ["count", "sum", "avg", "min", "max", "countDistinct"], 
    description: "Операция агрегации" 
  })
  @IsString()
  operation: "count" | "sum" | "avg" | "min" | "max" | "countDistinct";

  @ApiPropertyOptional({ description: "Условия фильтрации (JSON)" })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({ description: "Группировка по полю" })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

/**
 * DTO параметров пути для данных
 */
export class DataParamsDto {
  @ApiProperty({ enum: CustomDataOwnerType, description: "Тип владельца" })
  @IsEnum(CustomDataOwnerType)
  ownerType: CustomDataOwnerType;

  @ApiProperty({ description: "ID владельца" })
  @IsString()
  ownerId: string;

  @ApiProperty({ description: "Имя коллекции" })
  @IsString()
  collection: string;
}

/**
 * DTO параметров пути для конкретной записи
 */
export class DataKeyParamsDto extends DataParamsDto {
  @ApiProperty({ description: "Ключ записи" })
  @IsString()
  key: string;
}

/**
 * DTO ответа со списком записей
 */
export class DataListResponseDto {
  @ApiProperty({ description: "Данные" })
  data: any[];

  @ApiProperty({ description: "Общее количество записей" })
  total: number;

  @ApiProperty({ description: "Лимит" })
  limit: number;

  @ApiProperty({ description: "Смещение" })
  offset: number;

  @ApiProperty({ description: "Есть ли ещё записи" })
  hasMore: boolean;
}

/**
 * DTO для импорта данных
 */
export class ImportDataDto {
  @ApiProperty({ description: "Массив записей для импорта" })
  @IsArray()
  records: Record<string, any>[];

  @ApiPropertyOptional({ description: "Поле для использования как ключ" })
  @IsOptional()
  @IsString()
  keyField?: string;

  @ApiPropertyOptional({ 
    description: "Режим: skip - пропустить существующие, update - обновить, error - ошибка", 
    enum: ["skip", "update", "error"],
    default: "error"
  })
  @IsOptional()
  @IsString()
  onConflict?: "skip" | "update" | "error" = "error";
}

/**
 * DTO для экспорта данных
 */
export class ExportDataDto {
  @ApiPropertyOptional({ description: "Формат экспорта", enum: ["json", "csv"], default: "json" })
  @IsOptional()
  @IsString()
  format?: "json" | "csv" = "json";

  @ApiPropertyOptional({ description: "Фильтр (JSON)" })
  @IsOptional()
  @IsString()
  filter?: string;

  @ApiPropertyOptional({ description: "Поля для экспорта" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}
