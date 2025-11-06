import { IsString, IsNotEmpty, IsUUID, IsInt, Min } from "class-validator";

export class AddItemToCartDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class RemoveItemFromCartDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  productId: string;
}

