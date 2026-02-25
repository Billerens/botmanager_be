import {
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { StylePresetTarget } from "../../../database/entities/style-preset.entity";

export class GalleryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(StylePresetTarget)
  target?: StylePresetTarget;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isPlatformChoice?: boolean;

  @IsOptional()
  @IsEnum(["popular", "newest", "name"])
  sortBy?: "popular" | "newest" | "name";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
