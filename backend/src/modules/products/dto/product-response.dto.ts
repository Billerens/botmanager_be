import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({
    description: "Статус ошибки",
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение об ошибке",
    example: "Product not found",
  })
  message: string;

  @ApiProperty({
    description: "Код ошибки",
    example: "PRODUCT_NOT_FOUND",
    required: false,
  })
  errorCode?: string;

  @ApiProperty({
    description: "Дополнительные детали ошибки",
    example: {
      timestamp: "2024-01-15T10:30:00.000Z",
      productId: "123e4567-e89b-12d3-a456-426614174000",
    },
    required: false,
  })
  details?: Record<string, any>;
}

export class UpdateStockResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Stock updated successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID товара",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "Новое количество на складе",
    example: 50,
  })
  newStock: number;

  @ApiProperty({
    description: "Предыдущее количество",
    example: 30,
  })
  previousStock: number;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class ToggleActiveResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Product status toggled successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID товара",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "Новый статус активности",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Предыдущий статус",
    example: false,
  })
  previousStatus: boolean;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class DeleteResponseDto {
  @ApiProperty({
    description: "Статус операции",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате",
    example: "Product deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "ID удаленного товара",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  deletedId: string;

  @ApiProperty({
    description: "Дата удаления",
    example: "2024-01-15T10:30:00.000Z",
  })
  deletedAt: Date;
}

export class ProductResponseDto {
  @ApiProperty({
    description: "ID товара",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Название товара",
    example: "iPhone 15 Pro",
  })
  name: string;

  @ApiProperty({
    description: "Описание товара",
    example: "Новейший смартфон от Apple с улучшенной камерой",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Цена товара",
    example: 99999,
  })
  price: number;

  @ApiProperty({
    description: "Валюта",
    example: "RUB",
  })
  currency: string;

  @ApiProperty({
    description: "URL изображения товара",
    example: "https://example.com/product-image.jpg",
    required: false,
  })
  imageUrl?: string;

  @ApiProperty({
    description: "Категория товара",
    example: "Электроника",
    required: false,
  })
  category?: string;

  @ApiProperty({
    description: "Количество товара на складе",
    example: 10,
  })
  stock: number;

  @ApiProperty({
    description: "Активен ли товар",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Дополнительные данные товара",
    example: {
      weight: "200g",
      dimensions: "15x7x0.8cm",
      color: "Титан",
    },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "ID бота",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  botId: string;

  @ApiProperty({
    description: "Дата создания",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Дата обновления",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;
}

export class ProductStatsResponseDto {
  @ApiProperty({
    description: "Общее количество товаров",
    example: 150,
  })
  totalProducts: number;

  @ApiProperty({
    description: "Количество активных товаров",
    example: 120,
  })
  activeProducts: number;

  @ApiProperty({
    description: "Общая стоимость товаров на складе",
    example: 1500000,
  })
  totalStockValue: number;

  @ApiProperty({
    description: "Количество товаров с нулевым остатком",
    example: 5,
  })
  outOfStockProducts: number;

  @ApiProperty({
    description: "Средняя цена товара",
    example: 10000,
  })
  averagePrice: number;
}
