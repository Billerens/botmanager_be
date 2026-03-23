import { IsString, IsEnum, IsOptional, IsBoolean, IsNotEmpty, MaxLength } from "class-validator";
import { AiProviderType } from "../../../database/entities/ai-provider.entity";

export class CreateAiProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(AiProviderType)
  providerType: AiProviderType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
