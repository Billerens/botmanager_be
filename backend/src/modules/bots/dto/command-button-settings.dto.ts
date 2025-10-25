import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, MaxLength } from "class-validator";

export class CommandButtonSettingsDto {
  @ApiProperty({
    description: "Текст на кнопке",
    example: "Открыть магазин",
  })
  @IsString()
  @MaxLength(50, { message: "Текст кнопки не должен превышать 50 символов" })
  text: string;

  @ApiProperty({
    description: "Описание команды",
    example: "Открывает интерфейс магазина для просмотра товаров",
  })
  @IsString()
  @MaxLength(200, {
    message: "Описание команды не должно превышать 200 символов",
  })
  description: string;

  @ApiProperty({
    description:
      "Текст сообщения, которое отправляется пользователю при нажатии на кнопку",
    example: "Добро пожаловать в наш магазин! Выберите товар из каталога.",
  })
  @IsString()
  @MaxLength(1000, {
    message: "Текст сообщения не должен превышать 1000 символов",
  })
  messageText: string;
}

export class ButtonSettingsDto {
  @ApiPropertyOptional({
    description: "Настройки для кнопки типа 'command'",
    type: CommandButtonSettingsDto,
  })
  @IsOptional()
  command?: CommandButtonSettingsDto;

  @ApiPropertyOptional({
    description: "Настройки для кнопки типа 'menu_button'",
    example: { text: "Магазин", color: "#007bff" },
  })
  @IsOptional()
  menu_button?: {
    text: string;
    color?: string;
  };
}
