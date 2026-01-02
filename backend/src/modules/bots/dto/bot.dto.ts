import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateBotDto {
  @ApiProperty({ description: "Название бота", example: "Мой Telegram бот" })
  @IsString()
  @MinLength(1, { message: "Название бота обязательно" })
  @MaxLength(100, { message: "Название бота не должно превышать 100 символов" })
  name: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Бот для обработки заявок",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание бота не должно превышать 500 символов" })
  description?: string;

  @ApiProperty({
    description: "Токен бота от @BotFather",
    example: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
  })
  @IsString()
  @MinLength(1, { message: "Токен бота обязателен" })
  token: string;
}

export class UpdateBotDto {
  @ApiProperty({
    description: "Название бота",
    example: "Обновленное название бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Название бота не может быть пустым" })
  @MaxLength(100, { message: "Название бота не должно превышать 100 символов" })
  name?: string;

  @ApiProperty({
    description: "Описание бота",
    example: "Обновленное описание бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Описание бота не должно превышать 500 символов" })
  description?: string;

  // Поля для магазина удалены - используйте ShopsController
  // Поля для системы бронирования удалены - используйте BookingSystemsController
}
