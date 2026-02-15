import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

export class CreateProductDto {
  @ApiProperty({ description: "Название товара" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: "Цена товара" })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: "Валюта", default: "RUB" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = "RUB";

  @ApiPropertyOptional({ description: "Количество на складе", default: 0 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : value))
  @IsNumber()
  @Min(0)
  stockQuantity?: number = 0;

  @ApiPropertyOptional({ description: "URL изображений товара" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: "Параметры товара (JSON)" })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      "Вариации: массив { id, label, priceType: 'relative'|'fixed', priceModifier, isActive? }",
  })
  @IsOptional()
  @IsArray()
  variations?: Array<{
    id: string;
    label: string;
    priceType: "relative" | "fixed";
    priceModifier: number;
    isActive?: boolean;
  }>;

  @ApiPropertyOptional({
    description: "Разрешить базовый вариант без выбора вариации",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allowBaseOption?: boolean = true;

  @ApiPropertyOptional({ description: "Описание товара" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Активен ли товар", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: "ID категории товара" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: "Название товара" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Цена товара" })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseFloat(value) : value))
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: "Валюта" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: "Количество на складе" })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value) : value))
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ description: "URL изображений товара" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: "Параметры товара (JSON)" })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      "Вариации: массив { id, label, priceType: 'relative'|'fixed', priceModifier, isActive? }",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return value;
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  variations?: Array<{
    id: string;
    label: string;
    priceType: "relative" | "fixed";
    priceModifier: number;
    isActive?: boolean;
  }>;

  @ApiPropertyOptional({
    description: "Разрешить базовый вариант без выбора вариации",
  })
  @IsOptional()
  @IsBoolean()
  allowBaseOption?: boolean;

  @ApiPropertyOptional({ description: "Описание товара" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Активен ли товар" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "ID категории товара" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class ProductFiltersDto {
  @ApiPropertyOptional({ description: "Страница", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => (value ? Number(value) : 1))
  page?: number = 1;

  @ApiPropertyOptional({ description: "Количество на странице", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? Number(value) : 20))
  limit?: number = 20;

  @ApiPropertyOptional({ description: "Поиск по названию" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Фильтр по активности" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === true || value === false) return value;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Фильтр по наличию на складе" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === true || value === false) return value;
    return undefined;
  })
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    description: "Фильтр по категории (включая подкатегории)",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
