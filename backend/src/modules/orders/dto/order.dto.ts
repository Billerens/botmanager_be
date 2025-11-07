import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  IsEmail,
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
