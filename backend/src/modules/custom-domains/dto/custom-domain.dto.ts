import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DomainTargetType } from "../enums/domain-status.enum";

/**
 * DTO для создания кастомного домена
 */
export class CreateDomainDto {
  @ApiProperty({
    description: "Полное доменное имя",
    example: "shop.example.com",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/, {
    message: "Некорректный формат домена",
  })
  domain: string;

  @ApiProperty({
    description: "Тип целевого ресурса",
    enum: DomainTargetType,
    example: DomainTargetType.SHOP,
  })
  @IsEnum(DomainTargetType)
  targetType: DomainTargetType;

  @ApiPropertyOptional({
    description: "ID магазина (если targetType = shop)",
  })
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @ApiPropertyOptional({
    description: "ID системы бронирования (если targetType = booking)",
  })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({
    description: "ID кастомной страницы (если targetType = custom_page)",
  })
  @IsOptional()
  @IsUUID()
  customPageId?: string;
}

/**
 * Инструкция по настройке DNS записи
 */
export class DnsRecordInstruction {
  @ApiProperty({ example: 1 })
  step: number;

  @ApiProperty({ example: "Добавьте CNAME запись" })
  title: string;

  @ApiProperty({ example: "Войдите в панель управления DNS..." })
  description: string;

  @ApiProperty()
  record: {
    type: "CNAME" | "A" | "TXT";
    name: string;
    value: string;
    ttl: number;
  };

  @ApiPropertyOptional({ type: [String] })
  tips?: string[];
}

/**
 * Инструкция по верификации владения
 */
export class VerificationInstruction {
  @ApiProperty({ enum: ["dns_txt", "http_file"] })
  method: "dns_txt" | "http_file";

  @ApiProperty({ example: "Способ 1: TXT запись" })
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  record?: {
    type: string;
    name: string;
    value: string;
    ttl: number;
  };

  @ApiPropertyOptional()
  file?: {
    path: string;
    content: string;
  };
}

/**
 * Информация о DNS
 */
export class DnsInfo {
  @ApiProperty({ example: true })
  isConfigured: boolean;

  @ApiPropertyOptional()
  lastCheck?: Date;

  @ApiProperty({ type: [String], example: ["proxy.botmanager.io"] })
  records: string[];

  @ApiProperty({ example: "proxy.botmanager.io" })
  expectedCname: string;

  @ApiProperty({ type: [DnsRecordInstruction] })
  instructions: DnsRecordInstruction[];
}

/**
 * Информация о верификации
 */
export class VerificationInfo {
  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: "abc123-token-xyz" })
  token: string;

  @ApiPropertyOptional({ enum: ["dns_txt", "http_file"] })
  method?: "dns_txt" | "http_file";

  @ApiProperty({ type: [VerificationInstruction] })
  instructions: VerificationInstruction[];
}

/**
 * Информация о SSL сертификате
 */
export class SslInfo {
  @ApiProperty()
  issuedAt: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ example: "Let's Encrypt" })
  issuer: string;

  @ApiProperty({ example: 75 })
  daysUntilExpiry: number;

  @ApiProperty({ enum: ["valid", "expiring_soon", "expired"] })
  status: "valid" | "expiring_soon" | "expired";
}

/**
 * Ошибка домена
 */
export class DomainErrorDto {
  @ApiProperty({ example: "DNS_NOT_FOUND" })
  code: string;

  @ApiProperty({ example: "DNS-записи не найдены" })
  message: string;

  @ApiProperty()
  timestamp: Date;
}

/**
 * Предупреждение домена
 */
export class DomainWarningDto {
  @ApiProperty({ example: "SSL_EXPIRING_SOON" })
  code: string;

  @ApiProperty({ example: "SSL-сертификат истекает через 14 дней" })
  message: string;

  @ApiProperty()
  timestamp: Date;
}

/**
 * Полный ответ с информацией о домене
 */
export class DomainResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: "shop.example.com" })
  domain: string;

  @ApiProperty({ example: "awaiting_dns" })
  status: string;

  @ApiProperty({ enum: DomainTargetType })
  targetType: DomainTargetType;

  @ApiPropertyOptional()
  shopId?: string;

  @ApiPropertyOptional()
  bookingId?: string;

  @ApiPropertyOptional()
  customPageId?: string;

  @ApiProperty({ type: DnsInfo })
  dns: DnsInfo;

  @ApiProperty({ type: VerificationInfo })
  verification: VerificationInfo;

  @ApiPropertyOptional({ type: SslInfo })
  ssl?: SslInfo;

  @ApiProperty({ type: [DomainErrorDto] })
  errors: DomainErrorDto[];

  @ApiProperty({ type: [DomainWarningDto] })
  warnings: DomainWarningDto[];

  @ApiProperty({ example: true })
  canCheck: boolean;

  @ApiPropertyOptional()
  nextAllowedCheck?: Date;

  @ApiProperty({ example: 3 })
  checkAttempts: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

