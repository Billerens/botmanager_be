import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  IsEmail,
  IsArray,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  OrderStatus,
  OrderCustomerData,
} from "../../../database/entities/order.entity";
import { CartItem } from "../../../database/entities/cart.entity";

export class OrderCustomerDataDto implements OrderCustomerData {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateOrderDto {
  @IsObject()
  @ValidateNested()
  @Type(() => OrderCustomerDataDto)
  customerData: OrderCustomerDataDto;

  @IsOptional()
  @IsString()
  additionalMessage?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;
}

export class UpdateOrderCustomerDataDto {
  @IsObject()
  @ValidateNested()
  @Type(() => OrderCustomerDataDto)
  customerData: OrderCustomerDataDto;
}

/** Одна позиция при обновлении состава заказа (productId + quantity, цена берётся с сервера) */
export class OrderItemUpdateEntryDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  variationId?: string;
}

export class UpdateOrderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemUpdateEntryDto)
  items: OrderItemUpdateEntryDto[];
}
