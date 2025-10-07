import { IsString, IsOptional, IsBoolean, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateBotFlowDto {
  @ApiProperty({ description: "Название флоу" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Описание флоу", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "ID бота" })
  @IsString()
  botId: string;

  @ApiProperty({ description: "Активен ли флоу", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBotFlowDto {
  @ApiProperty({ description: "Название флоу", required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: "Описание флоу", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Активен ли флоу", required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBotFlowNodeDto {
  @ApiProperty({ description: "Тип ноды" })
  @IsString()
  type: string;

  @ApiProperty({ description: "Позиция ноды" })
  @IsObject()
  position: { x: number; y: number };

  @ApiProperty({ description: "Данные ноды" })
  @IsObject()
  data: any;

  @ApiProperty({ description: "ID флоу" })
  @IsString()
  flowId: string;
}

export class UpdateBotFlowNodeDto {
  @ApiProperty({ description: "Тип ноды", required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: "Позиция ноды", required: false })
  @IsOptional()
  @IsObject()
  position?: { x: number; y: number };

  @ApiProperty({ description: "Данные ноды", required: false })
  @IsOptional()
  @IsObject()
  data?: any;
}
