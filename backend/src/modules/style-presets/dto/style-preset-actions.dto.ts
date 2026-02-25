import { IsOptional, IsString } from "class-validator";

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
  isPlatformChoice: boolean;
}
