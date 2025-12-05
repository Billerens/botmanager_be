import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { PublicAuthService } from "./public-auth.service";
import { PublicUserGuard } from "./guards/public-user.guard";
import {
  RegisterPublicUserDto,
  LoginPublicUserDto,
  VerifyEmailDto,
  ResendVerificationEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  UpdatePublicUserProfileDto,
  ChangePublicUserPasswordDto,
  LinkTelegramDto,
} from "./dto/public-auth.dto";
import {
  PublicAuthResponseDto,
  PublicAuthMessageResponseDto,
  PublicUserResponseDto,
  TokenRefreshResponseDto,
} from "./dto/public-auth-response.dto";

@ApiTags("Public Auth")
@Controller("public/auth")
export class PublicAuthController {
  constructor(private readonly publicAuthService: PublicAuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Регистрация нового публичного пользователя" })
  @ApiResponse({
    status: 201,
    description: "Пользователь успешно зарегистрирован",
    type: PublicAuthResponseDto,
  })
  @ApiResponse({ status: 409, description: "Email уже существует" })
  async register(@Body() dto: RegisterPublicUserDto) {
    return this.publicAuthService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Вход публичного пользователя" })
  @ApiResponse({
    status: 200,
    description: "Успешный вход",
    type: PublicAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Неверные учетные данные" })
  async login(@Body() dto: LoginPublicUserDto) {
    return this.publicAuthService.login(dto);
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Верификация email" })
  @ApiResponse({
    status: 200,
    description: "Email успешно верифицирован",
    type: PublicAuthMessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Неверный или истекший код" })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.publicAuthService.verifyEmail(dto);
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Повторная отправка кода верификации" })
  @ApiResponse({
    status: 200,
    description: "Код отправлен",
    type: PublicAuthMessageResponseDto,
  })
  async resendVerification(@Body() dto: ResendVerificationEmailDto) {
    return this.publicAuthService.resendVerificationEmail(dto.email);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Запрос сброса пароля" })
  @ApiResponse({
    status: 200,
    description: "Инструкции отправлены",
    type: PublicAuthMessageResponseDto,
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.publicAuthService.forgotPassword(dto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Сброс пароля" })
  @ApiResponse({
    status: 200,
    description: "Пароль успешно изменен",
    type: PublicAuthMessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Недействительный токен" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.publicAuthService.resetPassword(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Обновление токенов" })
  @ApiResponse({
    status: 200,
    description: "Токены обновлены",
    type: TokenRefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: "Недействительный refresh токен" })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.publicAuthService.refreshTokens(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(PublicUserGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Выход из системы" })
  @ApiResponse({
    status: 200,
    description: "Выход выполнен",
    type: PublicAuthMessageResponseDto,
  })
  async logout(@Request() req: any) {
    return this.publicAuthService.logout(req.publicUser.id);
  }

  @Get("profile")
  @UseGuards(PublicUserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение профиля пользователя" })
  @ApiResponse({
    status: 200,
    description: "Профиль пользователя",
    type: PublicUserResponseDto,
  })
  async getProfile(@Request() req: any) {
    return this.publicAuthService.getProfile(req.publicUser.id);
  }

  @Put("profile")
  @UseGuards(PublicUserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Обновление профиля" })
  @ApiResponse({
    status: 200,
    description: "Профиль обновлен",
    type: PublicUserResponseDto,
  })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdatePublicUserProfileDto
  ) {
    return this.publicAuthService.updateProfile(req.publicUser.id, dto);
  }

  @Post("change-password")
  @UseGuards(PublicUserGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Изменение пароля" })
  @ApiResponse({
    status: 200,
    description: "Пароль изменен",
    type: PublicAuthMessageResponseDto,
  })
  async changePassword(
    @Request() req: any,
    @Body() dto: ChangePublicUserPasswordDto
  ) {
    return this.publicAuthService.changePassword(req.publicUser.id, dto);
  }

  @Post("link-telegram")
  @UseGuards(PublicUserGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Связывание с Telegram аккаунтом" })
  @ApiResponse({
    status: 200,
    description: "Telegram аккаунт связан",
    type: PublicUserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "Telegram уже связан с другим аккаунтом",
  })
  async linkTelegram(@Request() req: any, @Body() dto: LinkTelegramDto) {
    return this.publicAuthService.linkTelegram(req.publicUser.id, dto);
  }
}

