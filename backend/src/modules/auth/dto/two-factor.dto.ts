import { IsEnum, IsString, IsNotEmpty, Length, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TwoFactorType } from "../../../database/entities/user.entity";

export class InitializeTelegramTwoFactorDto {
  @ApiProperty({ description: "Telegram ID пользователя" })
  @IsString()
  @IsNotEmpty()
  telegramId: string;
}

export class InitializeGoogleAuthenticatorTwoFactorDto {
  @ApiProperty({ description: "ID пользователя" })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class EnableTwoFactorDto {
  @ApiProperty({
    description: "Тип двухфакторной аутентификации",
    enum: TwoFactorType,
  })
  @IsEnum(TwoFactorType)
  twoFactorType: TwoFactorType;

  @ApiProperty({ description: "Код верификации для подтверждения настройки" })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: "Код должен содержать только цифры" })
  verificationCode: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: "Текущий пароль пользователя" })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyTwoFactorCodeDto {
  @ApiProperty({ description: "Код двухфакторной аутентификации" })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SendTwoFactorCodeDto {
  @ApiProperty({ description: "Telegram ID пользователя" })
  @IsString()
  @IsNotEmpty()
  telegramId: string;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty({ description: "Включена ли двухфакторная аутентификация" })
  isEnabled: boolean;

  @ApiProperty({
    description: "Тип двухфакторной аутентификации",
    enum: TwoFactorType,
    required: false,
  })
  type?: TwoFactorType;

  @ApiProperty({ description: "Количество оставшихся резервных кодов" })
  backupCodesCount?: number;
}

export class InitializeTwoFactorResponseDto {
  @ApiProperty({
    description:
      "Секрет для Google Authenticator (только для Google Authenticator)",
  })
  secret?: string;

  @ApiProperty({ description: "Код верификации для подтверждения настройки" })
  verificationCode: string;

  @ApiProperty({ description: "Время истечения кода верификации" })
  expiresAt: Date;
}

export class EnableTwoFactorResponseDto {
  @ApiProperty({ description: "Резервные коды для восстановления доступа" })
  backupCodes: string[];
}
