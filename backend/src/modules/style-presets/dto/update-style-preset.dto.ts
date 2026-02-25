import { IsString, IsOptional, IsEnum, IsArray } from "class-validator";
import { StylePresetTarget } from "../../../database/entities/style-preset.entity";

export class UpdateStylePresetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StylePresetTarget)
  target?: StylePresetTarget;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  cssData?: string;
}
