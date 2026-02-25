import { IsString, IsOptional, IsEnum, IsArray, MaxLength } from "class-validator";
import { StylePresetTarget, StylePresetStatus } from "../../../database/entities/style-preset.entity";

export class CreateStylePresetDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(StylePresetTarget)
  target: StylePresetTarget;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  cssData: string;

  @IsOptional()
  @IsEnum(["draft", "private"])
  initialStatus?: "draft" | "private";
}
