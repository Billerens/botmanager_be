import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

export class CreateCategoryDto {
  @ApiProperty({ description: "Название категории" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: "Описание категории" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "URL изображения категории" })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: "ID родительской категории" })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: "Порядок сортировки", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number = 0;

  @ApiPropertyOptional({ description: "Активна ли категория", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: "Название категории" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Описание категории" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "URL изображения категории" })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: "ID родительской категории" })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: "Порядок сортировки" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: "Активна ли категория" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryFiltersDto {
  @ApiPropertyOptional({ description: "ID родительской категории (для получения подкатегорий)" })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: "Только корневые категории" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === true || value === false) return value;
    return undefined;
  })
  @IsBoolean()
  rootOnly?: boolean;

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
}

