import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CategoryResponseDto {
  @ApiProperty({ description: "ID категории" })
  id: string;

  @ApiProperty({ description: "Название категории" })
  name: string;

  @ApiPropertyOptional({ description: "Описание категории" })
  description?: string;

  @ApiPropertyOptional({ description: "URL изображения категории" })
  imageUrl?: string;

  @ApiProperty({ description: "Активна ли категория" })
  isActive: boolean;

  @ApiProperty({ description: "Порядок сортировки" })
  sortOrder: number;

  @ApiPropertyOptional({ description: "ID родительской категории" })
  parentId?: string;

  @ApiPropertyOptional({ description: "Родительская категория" })
  parent?: CategoryResponseDto;

  @ApiPropertyOptional({
    description: "Подкатегории",
    type: [CategoryResponseDto],
  })
  children?: CategoryResponseDto[];

  @ApiProperty({ description: "ID бота" })
  botId: string;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "Количество товаров в категории" })
  productsCount?: number;
}

export class CategoryTreeResponseDto {
  @ApiProperty({ description: "Список категорий", type: [CategoryResponseDto] })
  categories: CategoryResponseDto[];

  @ApiProperty({ description: "Общее количество категорий" })
  total: number;
}

export class ErrorResponseDto {
  @ApiProperty({ description: "Код статуса" })
  statusCode: number;

  @ApiProperty({ description: "Сообщение об ошибке" })
  message: string;

  @ApiPropertyOptional({ description: "Дополнительная информация об ошибке" })
  error?: string;
}

