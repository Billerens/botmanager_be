import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";

import { User, UserRole } from "../../database/entities/user.entity";
import { UsersService } from "../users/users.service";
import { LoginDto, RegisterDto, ChangePasswordDto } from "./dto/auth.dto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { EmailService } from "../../common/email.service";
import { VerificationRequiredResponseDto } from "./dto/auth-response.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService
  ) {}

  async register(
    registerDto: RegisterDto
  ): Promise<{ user: User; message: string; requiresVerification: boolean }> {
    const startTime = Date.now();
    const { email, password, firstName, lastName } = registerDto;

    this.logger.log(`=== НАЧАЛО РЕГИСТРАЦИИ ===`);
    this.logger.log(`Email: ${email}`);
    this.logger.log(`Имя: ${firstName} ${lastName}`);

    // Проверяем, существует ли пользователь
    this.logger.log(`Проверка существования пользователя с email: ${email}`);
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      this.logger.warn(`Пользователь с email ${email} уже существует`);
      throw new ConflictException("Пользователь с таким email уже существует");
    }
    this.logger.log(
      `Пользователь с email ${email} не найден, продолжаем регистрацию`
    );

    // Генерируем 6-значный код верификации
    this.logger.log(`Генерация кода верификации`);
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    this.logger.log(`Код верификации: ${verificationCode}`);
    this.logger.log(`Код истекает: ${verificationExpires.toISOString()}`);

    // СНАЧАЛА отправляем код на email и ждем успешной отправки
    this.logger.log(`Начало отправки email с кодом верификации`);
    const emailStartTime = Date.now();

    try {
      await this.emailService.sendVerificationCode(email, verificationCode);
      const emailDuration = Date.now() - emailStartTime;
      this.logger.log(`Email успешно отправлен за ${emailDuration}ms`);
    } catch (error) {
      const emailDuration = Date.now() - emailStartTime;
      this.logger.error(`Ошибка отправки email за ${emailDuration}ms:`, error);
      this.logger.error(`Детали ошибки: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      // Если email не удалось отправить, прерываем регистрацию
      throw new BadRequestException(
        `Не удалось отправить код верификации на email ${email}. Проверьте правильность email адреса.`
      );
    }

    // ТОЛЬКО ПОСЛЕ успешной отправки email создаем пользователя
    this.logger.log(
      `Email отправлен успешно, создание пользователя в базе данных`
    );
    const user = this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
      role: UserRole.OWNER,
      emailVerificationToken: crypto.randomBytes(32).toString("hex"), // Оставляем для совместимости
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires,
      isEmailVerified: false,
    });

    this.logger.log(`Сохранение пользователя в базу данных`);
    const savedUser = await this.userRepository.save(user);
    this.logger.log(`Пользователь сохранен с ID: ${savedUser.id}`);

    const totalDuration = Date.now() - startTime;
    this.logger.log(`=== РЕГИСТРАЦИЯ ЗАВЕРШЕНА ===`);
    this.logger.log(`Общее время выполнения: ${totalDuration}ms`);
    this.logger.log(`Пользователь ID: ${savedUser.id}`);

    return {
      user: savedUser,
      message: "Код верификации отправлен на email",
      requiresVerification: true,
    };
  }

  async login(
    loginDto: LoginDto
  ): Promise<
    { user: User; accessToken: string } | VerificationRequiredResponseDto
  > {
    const { email, password } = loginDto;

    // Находим пользователя
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    // Проверяем пароль
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    // Проверяем, верифицирован ли email
    if (!user.isEmailVerified) {
      this.logger.log(
        `Пользователь ${email} не верифицирован, предлагаем ввести код подтверждения`
      );

      // Проверяем, есть ли активный код верификации
      const hasActiveCode =
        user.emailVerificationCode &&
        user.emailVerificationExpires &&
        user.emailVerificationExpires > new Date();

      if (hasActiveCode) {
        this.logger.log(
          `У пользователя ${email} есть активный код верификации`
        );
        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            telegramId: user.telegramId,
            telegramUsername: user.telegramUsername,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          message:
            "Email не подтвержден. Введите код верификации, отправленный на вашу почту.",
          requiresVerification: true,
          email: user.email,
        };
      } else {
        this.logger.log(
          `У пользователя ${email} нет активного кода верификации, отправляем новый`
        );
        // Отправляем новый код верификации
        await this.resendVerificationEmail(email);
        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            telegramId: user.telegramId,
            telegramUsername: user.telegramUsername,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          message:
            "Email не подтвержден. Новый код верификации отправлен на вашу почту.",
          requiresVerification: true,
          email: user.email,
        };
      }
    }

    // Проверяем, активен ли пользователь
    if (!user.isActive) {
      throw new UnauthorizedException("Аккаунт заблокирован");
    }

    // Обновляем время последнего входа
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Генерируем JWT токен
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && (await user.validatePassword(password))) {
      return user;
    }
    return null;
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (user && user.isActive) {
      return user;
    }
    return null;
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Неверный текущий пароль");
    }

    // Обновляем пароль
    user.password = newPassword;
    await this.userRepository.save(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Не раскрываем информацию о существовании пользователя
      return;
    }

    // Генерируем токен сброса пароля
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 3600000); // 1 час

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await this.userRepository.save(user);

    // Здесь должна быть отправка email с токеном
    // TODO: Реализовать отправку email
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException(
        "Недействительный или истекший токен сброса пароля"
      );
    }

    // Обновляем пароль и очищаем токен
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        emailVerificationToken: token,
      },
    });

    if (!user) {
      throw new BadRequestException("Недействительный токен верификации");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    await this.userRepository.save(user);
  }

  async verifyEmailWithCode(
    email: string,
    code: string
  ): Promise<{ user: User; accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email уже верифицирован");
    }

    if (!user.emailVerificationCode) {
      throw new BadRequestException("Код верификации не найден");
    }

    if (
      user.emailVerificationExpires &&
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException("Код верификации истек");
    }

    if (user.emailVerificationCode !== code) {
      throw new BadRequestException("Неверный код верификации");
    }

    // Верифицируем email и очищаем код
    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    // Генерируем JWT токен для автоматического входа
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email уже верифицирован");
    }

    // Генерируем новый код
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    // СНАЧАЛА отправляем код на email
    try {
      await this.emailService.sendVerificationCode(email, verificationCode);
    } catch (error) {
      this.logger.error(`Ошибка отправки повторного email на ${email}:`, error);
      throw new BadRequestException(
        `Не удалось отправить код верификации на email ${email}. Проверьте правильность email адреса.`
      );
    }

    // ТОЛЬКО ПОСЛЕ успешной отправки обновляем пользователя
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = verificationExpires;
    await this.userRepository.save(user);
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Пользователь не найден или неактивен");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async updateProfile(
    userId: string,
    updateData: { firstName?: string; lastName?: string }
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Пользователь не найден или неактивен");
    }

    if (updateData.firstName !== undefined) {
      user.firstName = updateData.firstName;
    }
    if (updateData.lastName !== undefined) {
      user.lastName = updateData.lastName;
    }

    return await this.userRepository.save(user);
  }
}
