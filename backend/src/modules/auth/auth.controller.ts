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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ResendVerificationDto,
  VerifyEmailCodeDto,
  UpdateProfileDto,
} from "./dto/auth.dto";
import {
  AuthResponseDto,
  VerificationRequiredResponseDto,
} from "./dto/auth-response.dto";

@ApiTags("Аутентификация")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

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
    description: "Пользователь с таким email уже существует",
  })
  @ApiResponse({
    status: 400,
    description: "Не удалось отправить код верификации на email",
  })
  async register(@Body() registerDto: RegisterDto) {
    const startTime = Date.now();
    this.logger.log(`=== КОНТРОЛЛЕР РЕГИСТРАЦИИ ===`);
    this.logger.log(`Получен запрос на регистрацию: ${registerDto.email}`);

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
    description: "Требуется верификация email",
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
    return this.authService.requestPasswordReset(requestPasswordResetDto.email);
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

  @Get("verify-email")
  @ApiOperation({ summary: "Верификация email по токену (старый метод)" })
  @ApiResponse({ status: 200, description: "Email успешно верифицирован" })
  @ApiResponse({
    status: 400,
    description: "Недействительный токен верификации",
  })
  async verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post("verify-email-code")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Верификация email по коду" })
  @ApiResponse({
    status: 200,
    description: "Email успешно верифицирован, возвращает токен доступа",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Неверный код или код истек",
  })
  async verifyEmailWithCode(@Body() verifyEmailCodeDto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailWithCode(
      verifyEmailCodeDto.email,
      verifyEmailCodeDto.code
    );
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Повторная отправка кода верификации" })
  @ApiResponse({
    status: 200,
    description: "Код верификации отправлен на email",
  })
  @ApiResponse({
    status: 400,
    description: "Email уже верифицирован или пользователь не найден",
  })
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto
  ) {
    await this.authService.resendVerificationEmail(resendVerificationDto.email);
    return { message: "Код верификации отправлен на email" };
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
}
