import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { FlowTemplateType } from "../../../database/entities/flow-template.entity";

export class GalleryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(FlowTemplateType)
  type?: FlowTemplateType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === "string" ? value.split(",") : value
  )
  tags?: string[];

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isPlatformChoice?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: "popular" | "newest" | "name";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
