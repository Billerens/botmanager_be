import { IsString, IsOptional, IsBoolean } from "class-validator";

export class RejectTemplateDto {
  @IsString()
  reason: string;
}

export class RequestDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PlatformChoiceDto {
  @IsBoolean()
  isPlatformChoice: boolean;
}
