import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsObject,
  MaxLength,
} from "class-validator";
import {
  FlowTemplateType,
  FlowTemplateStatus,
} from "../../../database/entities/flow-template.entity";

export class CreateFlowTemplateDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FlowTemplateType)
  type: FlowTemplateType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsObject()
  flowData: {
    nodes: any[];
    edges: any[];
    viewport?: { x: number; y: number; zoom: number };
  };

  @IsOptional()
  @IsEnum(FlowTemplateStatus)
  initialStatus?: FlowTemplateStatus.DRAFT | FlowTemplateStatus.PRIVATE;
}
