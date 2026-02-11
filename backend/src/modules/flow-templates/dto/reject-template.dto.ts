import { IsString, IsOptional } from "class-validator";

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
  isPlatformChoice: boolean;
}
