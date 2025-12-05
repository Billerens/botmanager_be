import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PublicUserResponseDto {
  @ApiProperty({ description: "ID пользователя" })
  id: string;

  @ApiProperty({ description: "Email пользователя" })
  email: string;

  @ApiPropertyOptional({ description: "Имя пользователя" })
  firstName?: string;

  @ApiPropertyOptional({ description: "Фамилия пользователя" })
  lastName?: string;

  @ApiPropertyOptional({ description: "Телефон пользователя" })
  phone?: string;

  @ApiProperty({ description: "Email верифицирован" })
  isEmailVerified: boolean;

  @ApiPropertyOptional({ description: "Связанный Telegram ID" })
  telegramId?: string;

  @ApiPropertyOptional({ description: "Связанный Telegram username" })
  telegramUsername?: string;

  @ApiProperty({ description: "Дата создания" })
  createdAt: Date;

  @ApiProperty({ description: "Дата обновления" })
  updatedAt: Date;
}

export class PublicAuthResponseDto {
  @ApiProperty({ description: "Данные пользователя", type: PublicUserResponseDto })
  user: PublicUserResponseDto;

  @ApiProperty({ description: "Access токен" })
  accessToken: string;

  @ApiProperty({ description: "Refresh токен" })
  refreshToken: string;
}

export class PublicAuthMessageResponseDto {
  @ApiProperty({ description: "Сообщение" })
  message: string;
}

export class EmailVerificationRequiredResponseDto {
  @ApiProperty({ description: "Данные пользователя", type: PublicUserResponseDto })
  user: PublicUserResponseDto;

  @ApiProperty({ description: "Сообщение" })
  message: string;

  @ApiProperty({ description: "Требуется верификация email" })
  requiresEmailVerification: boolean;
}

export class TokenRefreshResponseDto {
  @ApiProperty({ description: "Новый access токен" })
  accessToken: string;

  @ApiProperty({ description: "Новый refresh токен" })
  refreshToken: string;
}

