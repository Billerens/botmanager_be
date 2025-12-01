import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum PaymentProviderDto {
  YOOKASSA = 'yookassa',
  TINKOFF = 'tinkoff',
  ROBOKASSA = 'robokassa',
  STRIPE = 'stripe',
}

export enum PaymentModuleDto {
  SHOP = 'shop',
  BOOKING = 'booking',
  API = 'api',
}

export enum CurrencyDto {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
}

// Amount DTO
export class AmountDto {
  @ApiProperty({ description: 'Сумма платежа', example: 100.5 })
  @IsNumber()
  @Min(0.01)
  value: number;

  @ApiProperty({ enum: CurrencyDto, description: 'Валюта', example: 'RUB' })
  @IsEnum(CurrencyDto)
  currency: CurrencyDto;
}

// Customer Data DTO
export class CustomerDataDto {
  @ApiPropertyOptional({ description: 'Email покупателя' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Телефон покупателя' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Полное имя покупателя' })
  @IsOptional()
  @IsString()
  fullName?: string;
}

// Create Payment Request DTO
export class CreatePaymentDto {
  @ApiProperty({ description: 'ID бота' })
  @IsUUID()
  botId: string;

  @ApiProperty({ enum: PaymentModuleDto, description: 'Модуль' })
  @IsEnum(PaymentModuleDto)
  module: PaymentModuleDto;

  @ApiProperty({ enum: PaymentProviderDto, description: 'Платежный провайдер' })
  @IsEnum(PaymentProviderDto)
  provider: PaymentProviderDto;

  @ApiProperty({ type: AmountDto, description: 'Сумма платежа' })
  @ValidateNested()
  @Type(() => AmountDto)
  amount: AmountDto;

  @ApiPropertyOptional({ description: 'Описание платежа' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID заказа' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ type: CustomerDataDto, description: 'Данные покупателя' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDataDto)
  customer?: CustomerDataDto;

  @ApiPropertyOptional({ description: 'Метаданные' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'URL возврата после успешной оплаты' })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiPropertyOptional({ description: 'URL возврата при отмене' })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}

// Refund Request DTO
export class RefundPaymentDto {
  @ApiProperty({ description: 'ID бота' })
  @IsUUID()
  botId: string;

  @ApiProperty({ enum: PaymentModuleDto, description: 'Модуль' })
  @IsEnum(PaymentModuleDto)
  module: PaymentModuleDto;

  @ApiProperty({ enum: PaymentProviderDto, description: 'Платежный провайдер' })
  @IsEnum(PaymentProviderDto)
  provider: PaymentProviderDto;

  @ApiProperty({ description: 'ID платежа в системе' })
  @IsString()
  paymentId: string;

  @ApiProperty({ description: 'Внешний ID платежа у провайдера' })
  @IsString()
  externalPaymentId: string;

  @ApiPropertyOptional({ description: 'Сумма возврата (если частичный)' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: 'Причина возврата' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Test Payment DTO
export class TestPaymentDto {
  @ApiProperty({ description: 'ID бота' })
  @IsUUID()
  botId: string;

  @ApiProperty({ enum: PaymentModuleDto, description: 'Модуль' })
  @IsEnum(PaymentModuleDto)
  module: PaymentModuleDto;

  @ApiProperty({ enum: PaymentProviderDto, description: 'Платежный провайдер' })
  @IsEnum(PaymentProviderDto)
  provider: PaymentProviderDto;

  @ApiProperty({ description: 'Сумма тестового платежа', example: 100 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: CurrencyDto, description: 'Валюта', example: 'RUB' })
  @IsEnum(CurrencyDto)
  currency: CurrencyDto;
}

// Payment Settings DTOs

export class YookassaSettingsDto {
  @ApiProperty({ description: 'Shop ID' })
  @IsString()
  shopId: string;

  @ApiProperty({ description: 'Secret Key' })
  @IsString()
  secretKey: string;

  @ApiPropertyOptional({ description: 'Agent ID' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Система налогообложения (1-6)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  taxSystem?: number;
}

export class TinkoffSettingsDto {
  @ApiProperty({ description: 'Terminal Key' })
  @IsString()
  terminalKey: string;

  @ApiProperty({ description: 'Secret Key' })
  @IsString()
  secretKey: string;

  @ApiPropertyOptional({ description: 'Система налогообложения' })
  @IsOptional()
  @IsString()
  taxation?: string;

  @ApiPropertyOptional({ description: 'Версия ФФД' })
  @IsOptional()
  @IsString()
  ffdVersion?: string;
}

export class RobokassaSettingsDto {
  @ApiProperty({ description: 'Merchant Login' })
  @IsString()
  merchantLogin: string;

  @ApiProperty({ description: 'Password 1' })
  @IsString()
  password1: string;

  @ApiProperty({ description: 'Password 2' })
  @IsString()
  password2: string;

  @ApiPropertyOptional({ description: 'Password 3' })
  @IsOptional()
  @IsString()
  password3?: string;

  @ApiPropertyOptional({ description: 'Password 4' })
  @IsOptional()
  @IsString()
  password4?: string;

  @ApiPropertyOptional({ description: 'Язык интерфейса' })
  @IsOptional()
  @IsString()
  culture?: string;
}

export class StripeSettingsDto {
  @ApiProperty({ description: 'Publishable Key' })
  @IsString()
  publishableKey: string;

  @ApiProperty({ description: 'Secret Key' })
  @IsString()
  secretKey: string;

  @ApiProperty({ description: 'Webhook Secret' })
  @IsString()
  webhookSecret: string;

  @ApiPropertyOptional({ description: 'Account ID (для Connect)' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Комиссия приложения (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  applicationFee?: number;
}

export class ModuleProviderSettingsDto {
  @ApiPropertyOptional({ type: YookassaSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => YookassaSettingsDto)
  yookassa?: YookassaSettingsDto;

  @ApiPropertyOptional({ type: TinkoffSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TinkoffSettingsDto)
  tinkoff?: TinkoffSettingsDto;

  @ApiPropertyOptional({ type: RobokassaSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RobokassaSettingsDto)
  robokassa?: RobokassaSettingsDto;

  @ApiPropertyOptional({ type: StripeSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StripeSettingsDto)
  stripe?: StripeSettingsDto;
}

export class ModulePaymentSettingsDto {
  @ApiProperty({ description: 'Модуль включен' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ enum: CurrencyDto, description: 'Валюта по умолчанию' })
  @IsEnum(CurrencyDto)
  currency: CurrencyDto;

  @ApiPropertyOptional({ description: 'Минимальная сумма' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Максимальная сумма' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'URL для webhook' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @ApiProperty({ description: 'Поддерживаемые методы оплаты' })
  @IsArray()
  @IsString({ each: true })
  supportedPaymentMethods: string[];

  @ApiProperty({ description: 'Требовать данные покупателя' })
  @IsBoolean()
  requireCustomerData: boolean;

  @ApiProperty({ description: 'Разрешить частичные платежи' })
  @IsBoolean()
  allowPartialPayments: boolean;

  @ApiProperty({ description: 'Отправлять подтверждения' })
  @IsBoolean()
  sendPaymentConfirmations: boolean;

  @ApiProperty({ description: 'Отправлять чеки' })
  @IsBoolean()
  sendReceipts: boolean;

  @ApiPropertyOptional({ description: 'Email для уведомлений' })
  @IsOptional()
  @IsEmail()
  emailForNotifications?: string;
}

export class ModuleConfigDto {
  @ApiProperty({ type: ModulePaymentSettingsDto })
  @ValidateNested()
  @Type(() => ModulePaymentSettingsDto)
  settings: ModulePaymentSettingsDto;

  @ApiProperty({ enum: PaymentProviderDto, isArray: true })
  @IsArray()
  @IsEnum(PaymentProviderDto, { each: true })
  providers: PaymentProviderDto[];

  @ApiProperty({ type: ModuleProviderSettingsDto })
  @ValidateNested()
  @Type(() => ModuleProviderSettingsDto)
  providerSettings: ModuleProviderSettingsDto;
}

export class GlobalPaymentSettingsDto {
  @ApiProperty({ description: 'Платежи включены' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Тестовый режим' })
  @IsBoolean()
  testMode: boolean;
}

export class PaymentModulesConfigDto {
  @ApiProperty({ type: ModuleConfigDto })
  @ValidateNested()
  @Type(() => ModuleConfigDto)
  shop: ModuleConfigDto;

  @ApiProperty({ type: ModuleConfigDto })
  @ValidateNested()
  @Type(() => ModuleConfigDto)
  booking: ModuleConfigDto;

  @ApiProperty({ type: ModuleConfigDto })
  @ValidateNested()
  @Type(() => ModuleConfigDto)
  api: ModuleConfigDto;
}

export class PaymentSettingsDto {
  @ApiProperty({ type: GlobalPaymentSettingsDto })
  @ValidateNested()
  @Type(() => GlobalPaymentSettingsDto)
  global: GlobalPaymentSettingsDto;

  @ApiProperty({ type: PaymentModulesConfigDto })
  @ValidateNested()
  @Type(() => PaymentModulesConfigDto)
  modules: PaymentModulesConfigDto;
}

// Response DTOs
export class PaymentResponseDto {
  @ApiProperty({ description: 'ID платежа' })
  id: string;

  @ApiProperty({ description: 'Внешний ID платежа' })
  externalId: string;

  @ApiProperty({ description: 'Статус платежа' })
  status: string;

  @ApiProperty({ type: AmountDto, description: 'Сумма' })
  amount: AmountDto;

  @ApiPropertyOptional({ description: 'URL для оплаты' })
  paymentUrl?: string;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Метаданные' })
  metadata?: Record<string, any>;
}

export class RefundResponseDto {
  @ApiProperty({ description: 'ID возврата' })
  id: string;

  @ApiProperty({ description: 'ID платежа' })
  paymentId: string;

  @ApiProperty({ description: 'Статус возврата' })
  status: string;

  @ApiProperty({ type: AmountDto, description: 'Сумма возврата' })
  amount: AmountDto;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;
}

