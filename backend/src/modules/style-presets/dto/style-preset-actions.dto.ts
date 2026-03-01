import { IsOptional, IsString, IsBoolean } from "class-validator";

export class RequestDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectPresetDto {
  @IsString()
  reason: string;
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
