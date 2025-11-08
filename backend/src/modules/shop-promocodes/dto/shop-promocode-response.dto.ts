import {
  ShopPromocodeType,
  ShopPromocodeApplicableTo,
  ShopPromocodeUsageLimit,
} from "../../../database/entities/shop-promocode.entity";

export class ShopPromocodeResponseDto {
  id: string;
  botId: string;
  code: string;
  type: ShopPromocodeType;
  value: number;
  applicableTo: ShopPromocodeApplicableTo;
  categoryId: string | null;
  productId: string | null;
  usageLimit: ShopPromocodeUsageLimit;
  maxUsageCount: number | null;
  currentUsageCount: number;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isAvailable: boolean;
}

export class PromocodeValidationResponseDto {
  isValid: boolean;
  promocode?: ShopPromocodeResponseDto;
  discount?: number;
  message?: string;
}

