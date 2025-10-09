import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsObject,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  MessageType,
  MessageContentType,
} from "../../../database/entities/message.entity";

export class CreateMessageDto {
  @ApiProperty({ description: "ID бота" })
  @IsString()
  botId: string;

  @ApiProperty({ description: "ID сообщения в Telegram" })
  @IsString()
  telegramMessageId: string;

  @ApiProperty({ description: "ID чата в Telegram" })
  @IsString()
  telegramChatId: string;

  @ApiProperty({ description: "ID пользователя в Telegram" })
  @IsString()
  telegramUserId: string;

  @ApiProperty({ description: "Тип сообщения", enum: MessageType })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiProperty({ description: "Тип контента", enum: MessageContentType })
  @IsEnum(MessageContentType)
  contentType: MessageContentType;

  @ApiProperty({ description: "Текст сообщения", required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ description: "Медиа данные", required: false })
  @IsOptional()
  @IsObject()
  media?: any;

  @ApiProperty({ description: "Клавиатура", required: false })
  @IsOptional()
  @IsObject()
  keyboard?: any;

  @ApiProperty({ description: "Метаданные", required: false })
  @IsOptional()
  @IsObject()
  metadata?: any;
}
