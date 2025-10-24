import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Patch,
  Logger,
  Param,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { TelegramUserInfoService } from "../../common/telegram-userinfo.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ResendVerificationDto,
  VerifyTelegramCodeDto,
  UpdateProfileDto,
} from "./dto/auth.dto";
import {
  InitializeTelegramTwoFactorDto,
  InitializeGoogleAuthenticatorTwoFactorDto,
  EnableTwoFactorDto,
  DisableTwoFactorDto,
  VerifyTwoFactorCodeDto,
  SendTwoFactorCodeDto,
  TwoFactorStatusResponseDto,
  InitializeTwoFactorResponseDto,
  EnableTwoFactorResponseDto,
} from "./dto/two-factor.dto";
import {
  AuthResponseDto,
  VerificationRequiredResponseDto,
} from "./dto/auth-response.dto";

@ApiTags("Аутентификация")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly telegramUserInfoService: TelegramUserInfoService
  ) {}

  @Get("telegram-user-info/:telegramId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Получение информации о пользователе Telegram" })
  @ApiResponse({
    status: 200,
    description: "Информация о пользователе Telegram",
  })
  @ApiResponse({
    status: 400,
    description: "Не удалось получить информацию о пользователе",
  })
  async getTelegramUserInfo(@Param("telegramId") telegramId: string) {
    const userInfo = await this.telegramUserInfoService.getUserInfo(telegramId);

    if (!userInfo) {
      throw new BadRequestException(
        "Не удалось получить информацию о пользователе. Убедитесь, что вы начали диалог с ботом."
      );
    }

    return {
      telegramId: userInfo.id.toString(),
      telegramUsername: userInfo.username,
      firstName: userInfo.first_name,
      lastName: userInfo.last_name,
      languageCode: userInfo.language_code,
    };
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Регистрация нового пользователя" })
  @ApiResponse({
    status: 201,
    description: "Пользователь успешно зарегистрирован",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "Пользователь с таким Telegram ID уже существует",
  })
  @ApiResponse({
    status: 400,
    description: "Не удалось отправить код верификации в Telegram",
  })
  async register(@Body() registerDto: RegisterDto) {
    const startTime = Date.now();
    this.logger.log(`=== КОНТРОЛЛЕР РЕГИСТРАЦИИ ===`);
    this.logger.log(`Получен запрос на регистрацию: ${registerDto.telegramId}`);

    try {
      const result = await this.authService.register(registerDto);
      const duration = Date.now() - startTime;
      this.logger.log(`Регистрация успешно завершена за ${duration}ms`);
      this.logger.log(`Пользователь ID: ${result.user.id}`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Ошибка регистрации за ${duration}ms:`, error);
      this.logger.error(`Детали ошибки: ${error.message}`);
      throw error;
    }
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Вход в систему" })
  @ApiResponse({
    status: 200,
    description: "Успешный вход",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: "Требуется верификация Telegram",
    type: VerificationRequiredResponseDto,
  })
  @ApiResponse({ status: 401, description: "Неверные учетные данные" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Обновление JWT токена" })
  @ApiResponse({ status: 200, description: "Токен успешно обновлен" })
  async refreshToken(@Request() req) {
    return this.authService.refreshToken(req.user.id);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Смена пароля" })
  @ApiResponse({ status: 200, description: "Пароль успешно изменен" })
  @ApiResponse({ status: 400, description: "Неверный текущий пароль" })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Post("request-password-reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Запрос сброса пароля" })
  @ApiResponse({ status: 200, description: "Запрос на сброс пароля отправлен" })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto
  ) {
    return this.authService.requestPasswordReset(
      requestPasswordResetDto.telegramId
    );
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Сброс пароля по токену" })
  @ApiResponse({ status: 200, description: "Пароль успешно сброшен" })
  @ApiResponse({
    status: 400,
    description: "Недействительный или истекший токен",
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    );
  }

  @Post("verify-telegram-code")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Верификация Telegram по коду" })
  @ApiResponse({
    status: 200,
    description: "Telegram успешно верифицирован, возвращает токен доступа",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Неверный код или код истек",
  })
  async verifyTelegramWithCode(
    @Body() verifyTelegramCodeDto: VerifyTelegramCodeDto
  ) {
    return this.authService.verifyTelegramWithCode(
      verifyTelegramCodeDto.telegramId,
      verifyTelegramCodeDto.code
    );
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Повторная отправка кода верификации" })
  @ApiResponse({
    status: 200,
    description: "Код верификации отправлен в Telegram",
  })
  @ApiResponse({
    status: 400,
    description: "Telegram уже верифицирован или пользователь не найден",
  })
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto
  ) {
    await this.authService.resendVerificationCode(
      resendVerificationDto.telegramId
    );
    return { message: "Код верификации отправлен в Telegram" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение информации о текущем пользователе" })
  @ApiResponse({ status: 200, description: "Информация о пользователе" })
  async getProfile(@Request() req) {
    return req.user;
  }

  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Обновление профиля пользователя" })
  @ApiResponse({ status: 200, description: "Профиль обновлен" })
  @ApiResponse({ status: 401, description: "Неавторизован" })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
  }

  // === 2FA ЭНДПОИНТЫ ===

  @Get("2fa/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получение статуса двухфакторной аутентификации" })
  @ApiResponse({
    status: 200,
    description: "Статус 2FA",
    type: TwoFactorStatusResponseDto,
  })
  async getTwoFactorStatus(
    @Request() req
  ): Promise<TwoFactorStatusResponseDto> {
    return this.twoFactorService.getTwoFactorStatus(req.user.id);
  }

  @Post("2fa/initialize/telegram")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Инициализация 2FA через Telegram" })
  @ApiResponse({
    status: 200,
    description: "Код верификации отправлен в Telegram",
    type: InitializeTwoFactorResponseDto,
  })
  async initializeTelegramTwoFactor(
    @Request() req
  ): Promise<InitializeTwoFactorResponseDto> {
    return this.twoFactorService.initializeTelegramTwoFactor(req.user.id);
  }

  @Post("2fa/initialize/google-authenticator")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Инициализация 2FA через Google Authenticator" })
  @ApiResponse({
    status: 200,
    description: "Секрет для Google Authenticator сгенерирован",
    type: InitializeTwoFactorResponseDto,
  })
  async initializeGoogleAuthenticatorTwoFactor(
    @Request() req
  ): Promise<InitializeTwoFactorResponseDto> {
    return this.twoFactorService.initializeGoogleAuthenticatorTwoFactor(
      req.user.id
    );
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Включение двухфакторной аутентификации" })
  @ApiResponse({
    status: 200,
    description: "2FA успешно включена",
    type: EnableTwoFactorResponseDto,
  })
  async enableTwoFactor(
    @Request() req,
    @Body() enableTwoFactorDto: EnableTwoFactorDto
  ): Promise<EnableTwoFactorResponseDto> {
    return this.twoFactorService.enableTwoFactor(
      req.user.id,
      enableTwoFactorDto.twoFactorType,
      enableTwoFactorDto.verificationCode
    );
  }

  @Post("2fa/disable/initialize")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Инициализация отключения двухфакторной аутентификации через Telegram",
  })
  @ApiResponse({
    status: 200,
    description: "Код подтверждения отправлен в Telegram",
  })
  async initializeDisableTwoFactor(
    @Request() req
  ): Promise<{ message: string }> {
    await this.twoFactorService.initializeDisableTelegramTwoFactor(req.user.id);
    return { message: "Код подтверждения отправлен в Telegram" };
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Отключение двухфакторной аутентификации" })
  @ApiResponse({
    status: 200,
    description: "2FA успешно отключена",
  })
  async disableTwoFactor(
    @Request() req,
    @Body() disableTwoFactorDto: DisableTwoFactorDto
  ): Promise<{ message: string }> {
    await this.twoFactorService.disableTwoFactor(
      req.user.id,
      disableTwoFactorDto.verificationCode
    );
    return { message: "Двухфакторная аутентификация отключена" };
  }

  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Проверка кода двухфакторной аутентификации" })
  @ApiResponse({
    status: 200,
    description: "Код проверен",
  })
  async verifyTwoFactorCode(
    @Body() verifyTwoFactorCodeDto: VerifyTwoFactorCodeDto
  ): Promise<{ isValid: boolean; isBackupCode?: boolean }> {
    // Этот эндпоинт будет использоваться при логине
    // userId будет передаваться в теле запроса
    const { userId } = verifyTwoFactorCodeDto as any;
    return this.twoFactorService.verifyTwoFactorCode(
      userId,
      verifyTwoFactorCodeDto.code
    );
  }

  @Post("2fa/send-telegram-code")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Отправка кода 2FA в Telegram" })
  @ApiResponse({
    status: 200,
    description: "Код отправлен в Telegram",
  })
  async sendTelegramTwoFactorCode(
    @Request() req
  ): Promise<{ message: string }> {
    await this.twoFactorService.sendTelegramTwoFactorCode(req.user.id);
    return { message: "Код отправлен в Telegram" };
  }

  @Post("2fa/complete-login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Завершение логина с проверкой 2FA" })
  @ApiResponse({
    status: 200,
    description: "Логин успешно завершен",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Неверный код 2FA",
  })
  async completeLoginWithTwoFactor(
    @Body() body: { userId: string; twoFactorCode: string }
  ) {
    return this.authService.completeLoginWithTwoFactor(
      body.userId,
      body.twoFactorCode
    );
  }
}
