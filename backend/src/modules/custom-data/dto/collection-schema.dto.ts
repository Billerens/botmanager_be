import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CustomDataOwnerType,
  FieldType,
  RelationType,
  FieldSchema,
  CollectionSchemaDefinition,
  CollectionRelation,
  CollectionAccessSettings,
  RowLevelSecurityRules,
} from "../../../database/entities/custom-collection-schema.entity";

/**
 * DTO для создания поля схемы
 */
export class FieldSchemaDto implements FieldSchema {
  @ApiProperty({ enum: FieldType, description: "Тип поля" })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({ description: "Обязательное поле" })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: "Значение по умолчанию" })
  @IsOptional()
  default?: any;

  @ApiPropertyOptional({ description: "Описание поля" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Минимальная длина (для строк)" })
  @IsOptional()
  minLength?: number;

  @ApiPropertyOptional({ description: "Максимальная длина (для строк)" })
  @IsOptional()
  maxLength?: number;

  @ApiPropertyOptional({ description: "Regex паттерн (для строк)" })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ description: "Минимальное значение (для чисел)" })
  @IsOptional()
  minimum?: number;

  @ApiPropertyOptional({ description: "Максимальное значение (для чисел)" })
  @IsOptional()
  maximum?: number;

  @ApiPropertyOptional({ description: "Варианты выбора (для select/multiselect)" })
  @IsOptional()
  @IsArray()
  options?: { value: string; label: string }[];

  @ApiPropertyOptional({ description: "Тип элементов массива" })
  @IsOptional()
  @IsObject()
  items?: { type: FieldType };

  @ApiPropertyOptional({ description: "Настройки связи" })
  @IsOptional()
  @IsObject()
  relation?: {
    targetCollection: string;
    type: RelationType;
    displayField?: string;
  };

  @ApiPropertyOptional({ description: "Placeholder для UI" })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: "Текст подсказки" })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ description: "Скрыто в UI" })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ description: "Только для чтения" })
  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @ApiPropertyOptional({ description: "Порядок сортировки в UI" })
  @IsOptional()
  sortOrder?: number;
}

/**
 * DTO для схемы коллекции
 */
export class CollectionSchemaDefinitionDto implements CollectionSchemaDefinition {
  @ApiProperty({ default: "object" })
  @IsString()
  type: "object" = "object";

  @ApiProperty({ description: "Поля коллекции", type: "object" })
  @IsObject()
  properties: Record<string, FieldSchema>;

  @ApiPropertyOptional({ description: "Список обязательных полей" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required?: string[];

  @ApiPropertyOptional({ description: "Разрешить дополнительные поля" })
  @IsOptional()
  @IsBoolean()
  additionalProperties?: boolean;
}

/**
 * DTO для связи между коллекциями
 */
export class CollectionRelationDto implements CollectionRelation {
  @ApiProperty({ description: "Имя поля связи" })
  @IsString()
  fieldName: string;

  @ApiProperty({ description: "Имя целевой коллекции" })
  @IsString()
  targetCollection: string;

  @ApiProperty({ enum: RelationType, description: "Тип связи" })
  @IsEnum(RelationType)
  type: RelationType;

  @ApiPropertyOptional({ description: "Действие при удалении" })
  @IsOptional()
  @IsString()
  onDelete?: "cascade" | "set-null" | "restrict";
}

/**
 * DTO для публичного доступа
 */
export class PublicAccessDto {
  @ApiPropertyOptional({ description: "Разрешено читать отдельные записи" })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ description: "Разрешено получать список записей" })
  @IsOptional()
  @IsBoolean()
  list?: boolean;
}

/**
 * DTO для доступа авторизованных пользователей
 */
export class AuthenticatedAccessDto {
  @ApiPropertyOptional({ description: "Разрешено читать отдельные записи" })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ description: "Разрешено получать список записей" })
  @IsOptional()
  @IsBoolean()
  list?: boolean;

  @ApiPropertyOptional({ description: "Разрешено создавать записи" })
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @ApiPropertyOptional({ description: "Разрешено обновлять записи" })
  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @ApiPropertyOptional({ description: "Разрешено удалять записи" })
  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

/**
 * DTO для настроек доступа к коллекции
 */
export class CollectionAccessSettingsDto implements CollectionAccessSettings {
  @ApiPropertyOptional({ description: "Публичный доступ", type: PublicAccessDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicAccessDto)
  public?: PublicAccessDto;

  @ApiPropertyOptional({ description: "Доступ авторизованных пользователей", type: AuthenticatedAccessDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthenticatedAccessDto)
  authenticated?: AuthenticatedAccessDto;
}

/**
 * DTO для правил Row-Level Security
 */
export class RowLevelSecurityRulesDto implements RowLevelSecurityRules {
  @ApiPropertyOptional({ description: "Условие для чтения записи" })
  @IsOptional()
  @IsString()
  read?: string;

  @ApiPropertyOptional({ description: "Условие для создания записи" })
  @IsOptional()
  @IsString()
  create?: string;

  @ApiPropertyOptional({ description: "Условие для обновления записи" })
  @IsOptional()
  @IsString()
  update?: string;

  @ApiPropertyOptional({ description: "Условие для удаления записи" })
  @IsOptional()
  @IsString()
  delete?: string;
}

/**
 * DTO для настроек UI
 */
export class UiSettingsDto {
  @ApiPropertyOptional({ enum: ["table", "cards", "list"], description: "Вид по умолчанию" })
  @IsOptional()
  @IsString()
  defaultView?: "table" | "cards" | "list";

  @ApiPropertyOptional({ description: "Порядок колонок" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columnsOrder?: string[];

  @ApiPropertyOptional({ description: "Скрытые колонки" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenColumns?: string[];

  @ApiPropertyOptional({ description: "Поле сортировки по умолчанию" })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], description: "Направление сортировки" })
  @IsOptional()
  @IsString()
  sortDirection?: "asc" | "desc";

  @ApiPropertyOptional({ description: "Размер страницы" })
  @IsOptional()
  pageSize?: number;
}

/**
 * DTO для создания коллекции
 */
export class CreateCollectionDto {
  @ApiProperty({ description: "Системное имя коллекции (slug)" })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: "Collection name must start with a letter and contain only lowercase letters, numbers and underscores",
  })
  collectionName: string;

  @ApiPropertyOptional({ description: "Отображаемое имя" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: "Описание коллекции" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "Иконка" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiProperty({ description: "Схема коллекции", type: CollectionSchemaDefinitionDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CollectionSchemaDefinitionDto)
  schema: CollectionSchemaDefinitionDto;

  @ApiPropertyOptional({ description: "Поле для заголовка записи" })
  @IsOptional()
  @IsString()
  titleField?: string;

  @ApiPropertyOptional({ description: "Связи с другими коллекциями", type: [CollectionRelationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionRelationDto)
  relations?: CollectionRelationDto[];

  @ApiPropertyOptional({ description: "Настройки UI", type: UiSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UiSettingsDto)
  uiSettings?: UiSettingsDto;

  @ApiPropertyOptional({ description: "Настройки доступа", type: CollectionAccessSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollectionAccessSettingsDto)
  accessSettings?: CollectionAccessSettingsDto;

  @ApiPropertyOptional({ description: "Правила Row-Level Security", type: RowLevelSecurityRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RowLevelSecurityRulesDto)
  rowLevelSecurity?: RowLevelSecurityRulesDto;
}

/**
 * DTO для обновления коллекции
 */
export class UpdateCollectionDto {
  @ApiPropertyOptional({ description: "Отображаемое имя" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: "Описание коллекции" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "Иконка" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: "Схема коллекции", type: CollectionSchemaDefinitionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CollectionSchemaDefinitionDto)
  schema?: CollectionSchemaDefinitionDto;

  @ApiPropertyOptional({ description: "Поле для заголовка записи" })
  @IsOptional()
  @IsString()
  titleField?: string;

  @ApiPropertyOptional({ description: "Связи с другими коллекциями", type: [CollectionRelationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionRelationDto)
  relations?: CollectionRelationDto[];

  @ApiPropertyOptional({ description: "Настройки UI", type: UiSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UiSettingsDto)
  uiSettings?: UiSettingsDto;

  @ApiPropertyOptional({ description: "Настройки доступа", type: CollectionAccessSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollectionAccessSettingsDto)
  accessSettings?: CollectionAccessSettingsDto;

  @ApiPropertyOptional({ description: "Правила Row-Level Security", type: RowLevelSecurityRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RowLevelSecurityRulesDto)
  rowLevelSecurity?: RowLevelSecurityRulesDto;

  @ApiPropertyOptional({ description: "Активна ли коллекция" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO параметров пути для коллекций
 */
export class CollectionParamsDto {
  @ApiProperty({ enum: CustomDataOwnerType, description: "Тип владельца" })
  @IsEnum(CustomDataOwnerType)
  ownerType: CustomDataOwnerType;

  @ApiProperty({ description: "ID владельца" })
  @IsString()
  ownerId: string;
}

/**
 * DTO параметров пути для конкретной коллекции
 */
export class CollectionNameParamsDto extends CollectionParamsDto {
  @ApiProperty({ description: "Имя коллекции" })
  @IsString()
  collectionName: string;
}
