import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

import { PublicUser } from "../../database/entities/public-user.entity";
import {
  RegisterPublicUserDto,
  LoginPublicUserDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdatePublicUserProfileDto,
  ChangePublicUserPasswordDto,
  LinkTelegramDto,
} from "./dto/public-auth.dto";
import { MailService } from "../mail/mail.service";

export interface PublicUserJwtPayload {
  sub: string; // publicUserId
  email: string;
  type: "public"; // Для отличия от обычных пользователей админки
}

@Injectable()
export class PublicAuthService {
  private readonly logger = new Logger(PublicAuthService.name);
  private readonly saltRounds = 10;

  constructor(
    @InjectRepository(PublicUser)
    private publicUserRepository: Repository<PublicUser>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService
  ) {}

  /**
   * Регистрация нового публичного пользователя
   */
  async register(dto: RegisterPublicUserDto): Promise<{
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
    message: string;
    requiresEmailVerification: boolean;
  }> {
    const { email, password, firstName, lastName, phone } = dto;

    this.logger.log(`Регистрация публичного пользователя: ${email}`);

    // Проверяем, существует ли пользователь
    const existingUser = await this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Генерируем код верификации email
    const emailVerificationCode = this.generateVerificationCode();
    const emailVerificationCodeExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ); // 24 часа

    // Создаем пользователя
    const user = this.publicUserRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone,
      isEmailVerified: false, // Требуется верификация
      emailVerificationCode,
      emailVerificationCodeExpires,
    });

    const savedUser = await this.publicUserRepository.save(user);
    this.logger.log(`Публичный пользователь создан: ${savedUser.id}`);

    // Генерируем токены
    const tokens = this.generateTokens(savedUser);

    // Сохраняем refresh token
    savedUser.refreshToken = tokens.refreshToken;
    await this.publicUserRepository.save(savedUser);

    // Отправляем email с кодом верификации
    const emailSent = await this.mailService.sendVerificationCode(
      email,
      emailVerificationCode
    );

    if (emailSent) {
      this.logger.log(`Код верификации отправлен на ${email}`);
    } else {
      this.logger.warn(
        `Email сервис не настроен. Код верификации для ${email}: ${emailVerificationCode}`
      );
    }

    return {
      user: this.sanitizeUser(savedUser),
      ...tokens,
      message: "Регистрация успешна. Код верификации отправлен на ваш email.",
      requiresEmailVerification: true,
    };
  }

  /**
   * Вход пользователя
   */
  async login(dto: LoginPublicUserDto): Promise<{
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const { email, password } = dto;

    const user = await this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    // Обновляем время последнего входа
    user.lastLoginAt = new Date();

    // Генерируем токены
    const tokens = this.generateTokens(user);

    // Сохраняем refresh token
    user.refreshToken = tokens.refreshToken;
    await this.publicUserRepository.save(user);

    this.logger.log(`Публичный пользователь вошел: ${user.id}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Верификация email
   */
  async verifyEmail(
    dto: VerifyEmailDto
  ): Promise<{ user: PublicUser; message: string }> {
    const { email, code } = dto;

    const user = await this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email уже верифицирован");
    }

    if (!user.emailVerificationCode) {
      throw new BadRequestException("Код верификации не найден");
    }

    if (user.isVerificationCodeExpired()) {
      throw new BadRequestException("Код верификации истек");
    }

    if (user.emailVerificationCode !== code) {
      throw new BadRequestException("Неверный код верификации");
    }

    // Верифицируем email
    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationCodeExpires = null;
    await this.publicUserRepository.save(user);

    this.logger.log(`Email верифицирован для пользователя: ${user.id}`);

    return {
      user: this.sanitizeUser(user),
      message: "Email успешно верифицирован",
    };
  }

  /**
   * Повторная отправка кода верификации
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Не раскрываем информацию о существовании пользователя
      return {
        message: "Если email существует, код верификации будет отправлен",
      };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email уже верифицирован");
    }

    // Генерируем новый код
    const emailVerificationCode = this.generateVerificationCode();
    const emailVerificationCodeExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    user.emailVerificationCode = emailVerificationCode;
    user.emailVerificationCodeExpires = emailVerificationCodeExpires;
    await this.publicUserRepository.save(user);

    // Отправляем email
    const emailSent = await this.mailService.sendVerificationCode(
      email,
      emailVerificationCode
    );

    if (emailSent) {
      this.logger.log(`Повторный код верификации отправлен на ${email}`);
    } else {
      this.logger.warn(
        `Email сервис не настроен. Код верификации для ${email}: ${emailVerificationCode}`
      );
    }

    return { message: "Код верификации отправлен на ваш email" };
  }

  /**
   * Запрос сброса пароля
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = dto;

    const user = await this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Не раскрываем информацию о существовании пользователя
      return {
        message:
          "Если email существует, инструкции по сбросу пароля будут отправлены",
      };
    }

    // Генерируем 6-значный код для сброса пароля (более user-friendly)
    const resetCode = this.generateVerificationCode();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    user.passwordResetToken = resetCode;
    user.passwordResetTokenExpires = resetExpires;
    await this.publicUserRepository.save(user);

    // Отправляем email с кодом сброса пароля
    const emailSent = await this.mailService.sendPasswordResetCode(
      email,
      resetCode
    );

    if (emailSent) {
      this.logger.log(`Код сброса пароля отправлен на ${email}`);
    } else {
      this.logger.warn(
        `Email сервис не настроен. Код сброса пароля для ${email}: ${resetCode}`
      );
    }

    return {
      message: "Инструкции по сбросу пароля отправлены на ваш email",
    };
  }

  /**
   * Сброс пароля
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = dto;

    const user = await this.publicUserRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user || user.isPasswordResetTokenExpired()) {
      throw new BadRequestException(
        "Недействительный или истекший токен сброса пароля"
      );
    }

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

    user.passwordHash = passwordHash;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    await this.publicUserRepository.save(user);

    this.logger.log(`Пароль сброшен для пользователя: ${user.id}`);

    return { message: "Пароль успешно изменен" };
  }

  /**
   * Обновление refresh токена
   */
  async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.publicUserRepository.findOne({
      where: { refreshToken },
    });

    if (!user) {
      throw new UnauthorizedException("Недействительный refresh токен");
    }

    // Генерируем новые токены
    const tokens = this.generateTokens(user);

    // Сохраняем новый refresh token
    user.refreshToken = tokens.refreshToken;
    await this.publicUserRepository.save(user);

    return tokens;
  }

  /**
   * Выход (инвалидация refresh токена)
   */
  async logout(userId: string): Promise<{ message: string }> {
    const user = await this.publicUserRepository.findOne({
      where: { id: userId },
    });

    if (user) {
      user.refreshToken = null;
      await this.publicUserRepository.save(user);
    }

    return { message: "Выход выполнен успешно" };
  }

  /**
   * Получение профиля пользователя
   */
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.publicUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    return this.sanitizeUser(user);
  }

  /**
   * Обновление профиля
   */
  async updateProfile(
    userId: string,
    dto: UpdatePublicUserProfileDto
  ): Promise<PublicUser> {
    const user = await this.publicUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;

    const updatedUser = await this.publicUserRepository.save(user);

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Изменение пароля
   */
  async changePassword(
    userId: string,
    dto: ChangePublicUserPasswordDto
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = dto;

    const user = await this.publicUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Неверный текущий пароль");
    }

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
    user.passwordHash = passwordHash;
    await this.publicUserRepository.save(user);

    return { message: "Пароль успешно изменен" };
  }

  /**
   * Связывание с Telegram аккаунтом
   */
  async linkTelegram(
    userId: string,
    dto: LinkTelegramDto
  ): Promise<PublicUser> {
    const user = await this.publicUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    // Проверяем, не связан ли уже этот Telegram ID с другим пользователем
    const existingLink = await this.publicUserRepository.findOne({
      where: { telegramId: dto.telegramId },
    });

    if (existingLink && existingLink.id !== userId) {
      throw new ConflictException(
        "Этот Telegram аккаунт уже связан с другим пользователем"
      );
    }

    user.telegramId = dto.telegramId;
    user.telegramUsername = dto.telegramUsername;

    const updatedUser = await this.publicUserRepository.save(user);

    this.logger.log(
      `Telegram ${dto.telegramId} связан с пользователем ${userId}`
    );

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Валидация JWT payload
   */
  async validateJwtPayload(
    payload: PublicUserJwtPayload
  ): Promise<PublicUser | null> {
    if (payload.type !== "public") {
      return null;
    }

    const user = await this.publicUserRepository.findOne({
      where: { id: payload.sub },
    });

    return user || null;
  }

  /**
   * Поиск пользователя по ID
   */
  async findById(id: string): Promise<PublicUser | null> {
    return this.publicUserRepository.findOne({ where: { id } });
  }

  /**
   * Поиск пользователя по email
   */
  async findByEmail(email: string): Promise<PublicUser | null> {
    return this.publicUserRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Поиск пользователя по Telegram ID
   */
  async findByTelegramId(telegramId: string): Promise<PublicUser | null> {
    return this.publicUserRepository.findOne({ where: { telegramId } });
  }

  // ============ Приватные методы ============

  private generateTokens(user: PublicUser): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: PublicUserJwtPayload = {
      sub: user.id,
      email: user.email,
      type: "public",
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "15m", // Access токен живет 15 минут
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: "7d", // Refresh токен живет 7 дней
    });

    return { accessToken, refreshToken };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: PublicUser): PublicUser {
    // Удаляем чувствительные данные
    const sanitized = { ...user };
    delete (sanitized as any).passwordHash;
    delete (sanitized as any).emailVerificationCode;
    delete (sanitized as any).emailVerificationCodeExpires;
    delete (sanitized as any).passwordResetToken;
    delete (sanitized as any).passwordResetTokenExpires;
    delete (sanitized as any).refreshToken;
    return sanitized as PublicUser;
  }
}
