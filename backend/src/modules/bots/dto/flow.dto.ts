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
  NEW_MESSAGE = "new_message",
  MESSAGE = "message",
  KEYBOARD = "keyboard",
  CONDITION = "condition",
  END = "end",
  FORM = "form",
  DELAY = "delay",
  VARIABLE = "variable",
  FILE = "file",
  WEBHOOK = "webhook",
  RANDOM = "random",
  INTEGRATION = "integration",
  ENDPOINT = "endpoint",
  BROADCAST = "broadcast",
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
  @IsObject()
  newMessage?: {
    text?: string;
    contentType?:
      | "text"
      | "photo"
      | "video"
      | "audio"
      | "document"
      | "sticker"
      | "voice"
      | "location"
      | "contact";
    caseSensitive?: boolean;
  };

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  messageText?: string;

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
  @IsObject()
  condition?: {
    field: string;
    operator:
      | "equals"
      | "not_equals"
      | "exists"
      | "not_exists"
      | "contains"
      | "not_contains"
      | "startsWith"
      | "endsWith"
      | "regex"
      | "greaterThan"
      | "lessThan"
      | "isEmpty"
      | "isNotEmpty";
    value: string;
    caseSensitive?: boolean;
  };

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

  @IsOptional()
  @IsObject()
  form?: {
    fields: Array<{
      id: string;
      label: string;
      type:
        | "text"
        | "email"
        | "phone"
        | "number"
        | "select"
        | "multiselect"
        | "date";
      required: boolean;
      placeholder?: string;
      options?: string[];
      validation?: {
        min?: number;
        max?: number;
        pattern?: string;
      };
    }>;
    submitText: string;
    successMessage: string;
  };

  @IsOptional()
  @IsObject()
  delay?: {
    value: number;
    unit: "seconds" | "minutes" | "hours" | "days";
  };

  @IsOptional()
  @IsObject()
  variable?: {
    name: string;
    value: string;
    operation: "set" | "append" | "prepend" | "increment" | "decrement";
    scope?: string;
  };

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsObject()
  file?: {
    type: "upload" | "download" | "send";
    accept?: string[];
    maxSize?: number;
    url?: string;
    filename?: string;
  };

  @IsOptional()
  @IsObject()
  webhook?: {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    retryCount?: number;
  };

  @IsOptional()
  @IsObject()
  random?: {
    options: Array<{
      value: string;
      weight?: number;
      label?: string;
    }>;
    variable?: string;
  };

  @IsOptional()
  @IsObject()
  integration?: {
    service: "crm" | "email" | "analytics" | "payment" | "custom";
    action: string;
    config: Record<string, any>;
  };

  @IsOptional()
  @IsObject()
  endpoint?: {
    url: string;
    accessKey: string;
  };

  @IsOptional()
  @IsObject()
  broadcast?: {
    text: string;
    buttons?: Array<{
      text: string;
      callbackData: string;
    }>;
    recipientType: "all" | "specific" | "activity";
    specificUsers?: string[];
    activityType?: "before" | "after";
    activityDate?: string;
  };
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
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

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
