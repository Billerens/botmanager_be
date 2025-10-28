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

  @IsOptional()
  @IsString()
  callbackData?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  webApp?: string;
}

export class BroadcastRecipientsDto {
  @IsEnum(["all", "specific", "activity", "groups", "specific_groups"])
  type: "all" | "specific" | "activity" | "groups" | "specific_groups";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificGroups?: string[];

  @IsOptional()
  @IsEnum(["before", "after"])
  activityType?: "before" | "after";

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsEnum(["private", "group", "supergroup", "channel"])
  chatType?: "private" | "group" | "supergroup" | "channel";
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
