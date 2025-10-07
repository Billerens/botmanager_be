import {
  IsString,
  IsArray,
  IsObject,
  IsOptional,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

export enum FlowNodeType {
  START = "start",
  MESSAGE = "message",
  KEYBOARD = "keyboard",
  CONDITION = "condition",
  API = "api",
  END = "end",
}

export class KeyboardButtonDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  callbackData?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  webApp?: any;
}

export class FlowNodeDataDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsEnum(["HTML", "Markdown", "Plain"])
  parseMode?: "HTML" | "Markdown" | "Plain";

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeyboardButtonDto)
  buttons?: KeyboardButtonDto[];

  @IsOptional()
  isInline?: boolean;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsEnum([
    "equals",
    "not_equals",
    "exists",
    "not_exists",
    "contains",
    "not_contains",
  ])
  operator?:
    | "equals"
    | "not_equals"
    | "exists"
    | "not_exists"
    | "contains"
    | "not_contains";

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  trueLabel?: string;

  @IsOptional()
  @IsString()
  falseLabel?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(["GET", "POST", "PUT", "DELETE"])
  method?: "GET" | "POST" | "PUT" | "DELETE";

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  responseMapping?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class FlowNodeDto {
  @IsString()
  id: string;

  @IsEnum(FlowNodeType)
  type: FlowNodeType;

  @IsObject()
  position: { x: number; y: number };

  @ValidateNested()
  @Type(() => FlowNodeDataDto)
  data: FlowNodeDataDto;
}

export class FlowEdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class FlowDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowNodeDto)
  nodes: FlowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowEdgeDto)
  edges: FlowEdgeDto[];

  @IsOptional()
  @IsObject()
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export class CreateFlowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => FlowDataDto)
  flowData: FlowDataDto;
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlowDataDto)
  flowData?: FlowDataDto;
}
