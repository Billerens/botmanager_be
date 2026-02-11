import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsInt,
  MaxLength,
} from "class-validator";

export class UpsertCategoryDto {
  @IsString()
  @MaxLength(64)
  slug: string;

  @IsObject()
  name: { ru: string; en: string; pl: string; de: string; ua: string };

  @IsOptional()
  @IsObject()
  description?: {
    ru?: string;
    en?: string;
    pl?: string;
    de?: string;
    ua?: string;
  };

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
