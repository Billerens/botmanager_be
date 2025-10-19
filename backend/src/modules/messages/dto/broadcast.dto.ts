import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class BroadcastButtonDto {
  @IsString()
  text: string;

  @IsString()
  callbackData: string;
}

export class BroadcastRecipientsDto {
  @IsEnum(["all", "specific", "activity"])
  type: "all" | "specific" | "activity";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificUsers?: string[];

  @IsOptional()
  @IsEnum(["before", "after"])
  activityType?: "before" | "after";

  @IsOptional()
  @IsDateString()
  activityDate?: string;
}

export class BroadcastDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  image?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BroadcastButtonDto)
  buttons?: BroadcastButtonDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => BroadcastRecipientsDto)
  recipients: BroadcastRecipientsDto;
}
