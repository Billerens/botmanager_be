import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Типы инструментов, доступных агенту
 */
export enum AgentToolType {
  STYLE_APPLY = "style_apply",
  STYLE_PREVIEW = "style_preview",
  STYLE_RESET = "style_reset",
  DATA_UPDATE = "data_update",
  COMPONENT_CONFIG = "component_config",
}

/**
 * Параметры для применения стилей
 */
export class StyleApplyParamsDto {
  @ApiProperty({
    description: "Тип контекста (shop, booking)",
    example: "booking",
  })
  @IsString()
  context: string;

  @ApiProperty({
    description: "CSS правила для применения",
    example: ".booking-page { background-color: var(--primary-color); }",
  })
  @IsString()
  cssRules: string;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Параметры для предварительного просмотра стилей
 */
export class StylePreviewParamsDto {
  @ApiProperty({
    description: "Тип контекста (shop, booking)",
    example: "booking",
  })
  @IsString()
  context: string;

  @ApiProperty({
    description: "CSS правила для предварительного просмотра",
    example: ".booking-page { background-color: #ff0000; }",
  })
  @IsString()
  cssRules: string;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Параметры для сброса стилей
 */
export class StyleResetParamsDto {
  @ApiProperty({
    description: "Тип контекста (shop, booking)",
    example: "booking",
  })
  @IsString()
  context: string;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Параметры для обновления данных
 */
export class DataUpdateParamsDto {
  @ApiProperty({
    description: "Тип данных для обновления",
    example: "specialists",
  })
  @IsString()
  dataType: string;

  @ApiProperty({
    description: "Новые данные",
    example: { name: "Новый специалист", services: [] },
  })
  @IsObject()
  data: any;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Параметры для настройки компонентов
 */
export class ComponentConfigParamsDto {
  @ApiProperty({
    description: "Тип компонента",
    example: "booking-form",
  })
  @IsString()
  componentType: string;

  @ApiProperty({
    description: "Конфигурация компонента",
    example: { showTimeSlots: true, allowMultipleBookings: false },
  })
  @IsObject()
  config: any;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Вызов инструмента агента
 */
export class AgentToolCallDto {
  @ApiProperty({
    description: "Тип инструмента",
    enum: AgentToolType,
  })
  @IsEnum(AgentToolType)
  toolType: AgentToolType;

  @ApiProperty({
    description: "Параметры инструмента",
    oneOf: [
      { $ref: "#/components/schemas/StyleApplyParamsDto" },
      { $ref: "#/components/schemas/StylePreviewParamsDto" },
      { $ref: "#/components/schemas/StyleResetParamsDto" },
      { $ref: "#/components/schemas/DataUpdateParamsDto" },
      { $ref: "#/components/schemas/ComponentConfigParamsDto" },
    ],
  })
  @IsObject()
  params:
    | StyleApplyParamsDto
    | StylePreviewParamsDto
    | StyleResetParamsDto
    | DataUpdateParamsDto
    | ComponentConfigParamsDto;
}

/**
 * Результат выполнения инструмента
 */
export class AgentToolResultDto {
  @ApiProperty({
    description: "Успешно ли выполнено",
  })
  success: boolean;

  @ApiProperty({
    description: "Результат выполнения",
    required: false,
  })
  @IsOptional()
  @IsObject()
  result?: any;

  @ApiProperty({
    description: "Сообщение об ошибке",
    required: false,
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: "Идентификатор действия для отмены",
    required: false,
  })
  @IsOptional()
  @IsString()
  actionId?: string;
}

/**
 * Запрос на выполнение инструментов агента
 */
export class ExecuteAgentToolsDto {
  @ApiProperty({
    description: "Список вызовов инструментов",
    type: [AgentToolCallDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentToolCallDto)
  toolCalls: AgentToolCallDto[];
}

/**
 * Ответ на выполнение инструментов агента
 */
export class ExecuteAgentToolsResponseDto {
  @ApiProperty({
    description: "Результаты выполнения инструментов",
    type: [AgentToolResultDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentToolResultDto)
  results: AgentToolResultDto[];
}

/**
 * Запрос на отмену действия агента
 */
export class UndoAgentActionDto {
  @ApiProperty({
    description: "Идентификатор действия для отмены",
  })
  @IsString()
  actionId: string;

  @ApiProperty({
    description: "Идентификатор бота",
    required: false,
  })
  @IsOptional()
  @IsString()
  botId?: string;
}

/**
 * Ответ на отмену действия агента
 */
export class UndoAgentActionResponseDto {
  @ApiProperty({
    description: "Успешно ли отменено действие",
  })
  success: boolean;

  @ApiProperty({
    description: "Сообщение о результате отмены",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: "Описание отмененного действия",
    required: false,
  })
  @IsOptional()
  @IsObject()
  undoneAction?: any;
}
