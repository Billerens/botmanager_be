import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateProductDto {
  @ApiProperty({ description: "Название товара" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: "Цена товара" })
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
  @IsNumber()
  @Min(0)
  stockQuantity?: number = 0;

  @ApiPropertyOptional({ description: "Изображения в base64" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: "Параметры товара (JSON)" })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: "Описание товара" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Активен ли товар", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: "Название товара" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Цена товара" })
  @IsOptional()
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
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ description: "Изображения в base64" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: "Параметры товара (JSON)" })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: "Описание товара" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Активен ли товар" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductFiltersDto {
  @ApiPropertyOptional({ description: "Страница", default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Количество на странице", default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @MaxLength(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: "Поиск по названию" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Фильтр по активности" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Фильтр по наличию на складе" })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}
