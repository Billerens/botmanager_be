import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsObject,
  MaxLength,
} from "class-validator";
import { FlowTemplateType } from "../../../database/entities/flow-template.entity";

export class UpdateFlowTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FlowTemplateType)
  type?: FlowTemplateType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  flowData?: {
    nodes: any[];
    edges: any[];
    viewport?: { x: number; y: number; zoom: number };
  };
}
