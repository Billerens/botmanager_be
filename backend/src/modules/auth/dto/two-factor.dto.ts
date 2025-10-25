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
  @ApiProperty({
    description:
      "Код двухфакторной аутентификации для подтверждения отключения",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: "Код должен содержать только цифры" })
  verificationCode: string;
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
  @ApiProperty({
    description: "Включена ли двухфакторная аутентификация",
    example: true,
  })
  isEnabled: boolean;

  @ApiProperty({
    description: "Тип двухфакторной аутентификации",
    enum: TwoFactorType,
    example: TwoFactorType.TELEGRAM,
    required: false,
  })
  type?: TwoFactorType;

  @ApiProperty({
    description: "Количество оставшихся резервных кодов",
    example: 8,
  })
  backupCodesCount?: number;
}

export class InitializeTwoFactorResponseDto {
  @ApiProperty({
    description:
      "Секрет для Google Authenticator (только для Google Authenticator)",
    example: "JBSWY3DPEHPK3PXP",
    required: false,
  })
  secret?: string;

  @ApiProperty({
    description: "Код верификации для подтверждения настройки",
    example: "123456",
    required: false,
  })
  verificationCode?: string;

  @ApiProperty({
    description: "Время истечения кода верификации",
    example: "2024-01-15T10:35:00.000Z",
    required: false,
  })
  expiresAt?: Date;
}

export class EnableTwoFactorResponseDto {
  @ApiProperty({
    description: "Резервные коды для восстановления доступа",
    example: ["12345678", "87654321", "11223344", "44332211", "55667788"],
  })
  backupCodes: string[];
}
