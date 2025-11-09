import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
  Max,
  ValidateIf,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  ShopPromocodeType,
  ShopPromocodeApplicableTo,
  ShopPromocodeUsageLimit,
} from "../../../database/entities/shop-promocode.entity";

export class CreateShopPromocodeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  botId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(ShopPromocodeType)
  type: ShopPromocodeType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsEnum(ShopPromocodeApplicableTo)
  applicableTo: ShopPromocodeApplicableTo;

  @ValidateIf((o) => o.applicableTo === ShopPromocodeApplicableTo.CATEGORY)
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  categoryId?: string;

  @ValidateIf((o) => o.applicableTo === ShopPromocodeApplicableTo.PRODUCT)
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  productId?: string;

  @IsEnum(ShopPromocodeUsageLimit)
  usageLimit: ShopPromocodeUsageLimit;

  @ValidateIf((o) => o.usageLimit === ShopPromocodeUsageLimit.LIMITED)
  @IsNumber()
  @Min(1)
  maxUsageCount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  validFrom?: Date;

  @IsOptional()
  validUntil?: Date;
}

export class UpdateShopPromocodeDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(ShopPromocodeType)
  @IsOptional()
  type?: ShopPromocodeType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsEnum(ShopPromocodeApplicableTo)
  @IsOptional()
  applicableTo?: ShopPromocodeApplicableTo;

  @IsString()
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @IsString()
  @IsUUID()
  @IsOptional()
  productId?: string | null;

  @IsEnum(ShopPromocodeUsageLimit)
  @IsOptional()
  usageLimit?: ShopPromocodeUsageLimit;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsageCount?: number | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  validFrom?: Date | null;

  @IsOptional()
  validUntil?: Date | null;
}

export class ValidatePromocodeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  botId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ApplyPromocodeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  botId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ShopPromocodeFiltersDto {
  @ApiPropertyOptional({
    description: "Фильтр по типу промокода",
    enum: ShopPromocodeType,
  })
  @IsOptional()
  @IsEnum(ShopPromocodeType)
  type?: ShopPromocodeType;

  @ApiPropertyOptional({
    description: "Фильтр по применимости промокода",
    enum: ShopPromocodeApplicableTo,
  })
  @IsOptional()
  @IsEnum(ShopPromocodeApplicableTo)
  applicableTo?: ShopPromocodeApplicableTo;

  @ApiPropertyOptional({
    description: "Фильтр по ограничению использования",
    enum: ShopPromocodeUsageLimit,
  })
  @IsOptional()
  @IsEnum(ShopPromocodeUsageLimit)
  usageLimit?: ShopPromocodeUsageLimit;

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

  @ApiPropertyOptional({ description: "Фильтр по статусу доступности" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === true || value === false) return value;
    return undefined;
  })
  @IsBoolean()
  isAvailable?: boolean;
}
