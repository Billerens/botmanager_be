import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";

import { User, UserRole } from "../../database/entities/user.entity";
import { UsersService } from "../users/users.service";
import { TwoFactorService } from "./two-factor.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  VerifyTelegramCodeDto,
  ResendVerificationDto,
} from "./dto/auth.dto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { TelegramValidationService } from "../../common/telegram-validation.service";
import {
  VerificationRequiredResponseDto,
  TwoFactorRequiredResponseDto,
} from "./dto/auth-response.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private telegramValidationService: TelegramValidationService,
    private twoFactorService: TwoFactorService,
    private activityLogService: ActivityLogService,
    private configService: ConfigService
  ) {}

  /**
   * Проверяет, разрешен ли пользователь для регистрации/входа
   * Если ALLOWED_USERS не задан, проверка не выполняется (разрешены все)
   */
  private checkAllowedUser(telegramId: string): void {
    // Используем process.env напрямую, так как переменная может быть не определена в конфигурационных файлах
    const allowedUsers =
      process.env.ALLOWED_USERS ||
      this.configService.get<string>("ALLOWED_USERS");

    if (!allowedUsers) {
      // Если переменная не задана, разрешаем всем
      return;
    }

    const allowedIds = allowedUsers
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (allowedIds.length === 0) {
      // Если список пустой, разрешаем всем
      return;
    }

    if (!allowedIds.includes(telegramId)) {
      this.logger.warn(
        `Попытка доступа пользователя ${telegramId}, который не в списке разрешенных`
      );
      throw new ForbiddenException(
        "Доступ ограничен. Ваш Telegram ID не в списке разрешенных пользователей."
      );
    }
  }

  async register(
    registerDto: RegisterDto
  ): Promise<{ user: User; message: string; requiresVerification: boolean }> {
    const startTime = Date.now();
    const { telegramId, telegramUsername, password, firstName, lastName } =
      registerDto;

    this.logger.log(`=== НАЧАЛО РЕГИСТРАЦИИ ===`);
    this.logger.log(`Telegram ID: ${telegramId}`);

    // Проверяем, разрешен ли пользователь для регистрации
    this.checkAllowedUser(telegramId);
    this.logger.log(`Telegram Username: ${telegramUsername || "не указан"}`);
    this.logger.log(`Имя: ${firstName} ${lastName}`);

    // Проверяем, существует ли пользователь
    this.logger.log(
      `Проверка существования пользователя с Telegram ID: ${telegramId}`
    );
    const existingUser = await this.userRepository.findOne({
      where: { telegramId },
    });
    if (existingUser) {
      this.logger.warn(
        `Пользователь с Telegram ID ${telegramId} уже существует`
      );
      throw new ConflictException(
        "Пользователь с таким Telegram ID уже существует"
      );
    }
    this.logger.log(
      `Пользователь с Telegram ID ${telegramId} не найден, продолжаем регистрацию`
    );

    // Генерируем 6-значный код верификации
    this.logger.log(`Генерация кода верификации`);
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    this.logger.log(`Код верификации: ${verificationCode}`);
    this.logger.log(`Код истекает: ${verificationExpires.toISOString()}`);

    // СНАЧАЛА отправляем код в Telegram и ждем успешной отправки
    this.logger.log(`Начало отправки кода верификации в Telegram`);
    const telegramStartTime = Date.now();

    try {
      const sent = await this.telegramValidationService.sendVerificationCode(
        telegramId,
        verificationCode
      );
      if (!sent) {
        throw new Error("Не удалось отправить код в Telegram");
      }
      const telegramDuration = Date.now() - telegramStartTime;
      this.logger.log(
        `Код успешно отправлен в Telegram за ${telegramDuration}ms`
      );
    } catch (error) {
      const telegramDuration = Date.now() - telegramStartTime;
      this.logger.error(
        `Ошибка отправки кода в Telegram за ${telegramDuration}ms:`,
        error
      );
      this.logger.error(`Детали ошибки: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      // Если код не удалось отправить, прерываем регистрацию
      throw new BadRequestException(
        `Не удалось отправить код верификации в Telegram. Проверьте правильность Telegram ID и убедитесь, что вы начали диалог с ботом.`
      );
    }

    // ТОЛЬКО ПОСЛЕ успешной отправки создаем пользователя
    this.logger.log(
      `Код отправлен успешно, создание пользователя в базе данных`
    );
    const user = this.userRepository.create({
      telegramId,
      telegramUsername,
      password,
      firstName,
      lastName,
      role: UserRole.OWNER,
      telegramVerificationCode: verificationCode,
      telegramVerificationExpires: verificationExpires,
      isTelegramVerified: false,
    });

    this.logger.log(`Сохранение пользователя в базу данных`);
    const savedUser = await this.userRepository.save(user);
    this.logger.log(`Пользователь сохранен с ID: ${savedUser.id}`);

    const totalDuration = Date.now() - startTime;
    this.logger.log(`=== РЕГИСТРАЦИЯ ЗАВЕРШЕНА ===`);
    this.logger.log(`Общее время выполнения: ${totalDuration}ms`);
    this.logger.log(`Пользователь ID: ${savedUser.id}`);

    // Логируем регистрацию пользователя
    this.activityLogService
      .create({
        type: ActivityType.USER_REGISTERED,
        level: ActivityLevel.SUCCESS,
        message: `Пользователь ${firstName} ${lastName} (${telegramId}) зарегистрирован`,
        userId: savedUser.id,
        metadata: {
          telegramId,
          telegramUsername,
          firstName,
          lastName,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования регистрации:", error);
      });

    return {
      user: savedUser,
      message: "Код верификации отправлен в Telegram",
      requiresVerification: true,
    };
  }

  async login(
    loginDto: LoginDto
  ): Promise<
    | { user: User; accessToken: string }
    | VerificationRequiredResponseDto
    | TwoFactorRequiredResponseDto
  > {
    const { telegramId, password } = loginDto;

    // Проверяем, разрешен ли пользователь для входа
    this.checkAllowedUser(telegramId);

    // Находим пользователя
    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      throw new UnauthorizedException("Неверный Telegram ID или пароль");
    }

    // Проверяем пароль
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Неверный Telegram ID или пароль");
    }

    // Проверяем, верифицирован ли Telegram
    if (!user.isTelegramVerified) {
      this.logger.log(
        `Пользователь ${telegramId} не верифицирован, предлагаем ввести код подтверждения`
      );

      // Проверяем, есть ли активный код верификации
      const hasActiveCode =
        user.telegramVerificationCode &&
        user.telegramVerificationExpires &&
        user.telegramVerificationExpires > new Date();

      if (hasActiveCode) {
        this.logger.log(
          `У пользователя ${telegramId} есть активный код верификации`
        );
        return {
          user: {
            id: user.id,
            telegramId: user.telegramId,
            telegramUsername: user.telegramUsername,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            isTelegramVerified: user.isTelegramVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          message:
            "Telegram не подтвержден. Введите код верификации, отправленный в Telegram.",
          requiresVerification: true,
          telegramId: user.telegramId,
        };
      } else {
        this.logger.log(
          `У пользователя ${telegramId} нет активного кода верификации, отправляем новый`
        );
        // Отправляем новый код верификации
        await this.resendVerificationCode(telegramId);
        return {
          user: {
            id: user.id,
            telegramId: user.telegramId,
            telegramUsername: user.telegramUsername,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            isTelegramVerified: user.isTelegramVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          message:
            "Telegram не подтвержден. Новый код верификации отправлен в Telegram.",
          requiresVerification: true,
          telegramId: user.telegramId,
        };
      }
    }

    // Проверяем, активен ли пользователь
    if (!user.isActive) {
      throw new UnauthorizedException("Аккаунт заблокирован");
    }

    // Проверяем, включена ли 2FA
    if (user.isTwoFactorEnabled) {
      this.logger.log(
        `Пользователь ${telegramId} имеет включенную 2FA, требуется дополнительная проверка`
      );

      // Для Telegram отправляем код подтверждения
      if (user.twoFactorType === "telegram") {
        try {
          await this.twoFactorService.sendTelegramTwoFactorCode(user.id);
          this.logger.log(
            `Код 2FA отправлен в Telegram для пользователя ${telegramId}`
          );
        } catch (error) {
          this.logger.error(
            `Ошибка отправки кода 2FA в Telegram для пользователя ${telegramId}:`,
            error
          );
          // Не прерываем процесс, пользователь может использовать резервные коды
        }
      }

      return {
        user: {
          id: user.id,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          isTelegramVerified: user.isTelegramVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          twoFactorType: user.twoFactorType,
        },
        message:
          user.twoFactorType === "telegram"
            ? "Код двухфакторной аутентификации отправлен в Telegram"
            : "Требуется код двухфакторной аутентификации",
        requiresTwoFactor: true,
        telegramId: user.telegramId,
      };
    }

    // Обновляем время последнего входа
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Генерируем JWT токен
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Логируем вход пользователя
    this.activityLogService
      .create({
        type: ActivityType.USER_LOGIN,
        level: ActivityLevel.INFO,
        message: `Пользователь ${user.firstName} ${user.lastName} (${user.telegramId}) вошел в систему`,
        userId: user.id,
        metadata: {
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования входа:", error);
      });

    return {
      user,
      accessToken,
    };
  }

  async validateUser(
    telegramId: string,
    password: string
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { telegramId } });
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

    // Логируем смену пароля
    this.activityLogService
      .create({
        type: ActivityType.USER_UPDATED,
        level: ActivityLevel.INFO,
        message: `Пользователь ${user.firstName} ${user.lastName} изменил пароль`,
        userId: user.id,
        metadata: {
          action: "password_change",
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования смены пароля:", error);
      });
  }

  async requestPasswordReset(telegramId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { telegramId } });
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

    // Здесь должна быть отправка сообщения в Telegram с токеном
    // TODO: Реализовать отправку сообщения в Telegram
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

    // Логируем сброс пароля
    this.activityLogService
      .create({
        type: ActivityType.USER_PASSWORD_RESET,
        level: ActivityLevel.WARNING,
        message: `Пароль пользователя ${user.firstName} ${user.lastName} (${user.telegramId}) сброшен`,
        userId: user.id,
        metadata: {
          telegramId: user.telegramId,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования сброса пароля:", error);
      });
  }

  async verifyTelegramWithCode(
    telegramId: string,
    code: string
  ): Promise<{ user: User; accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { telegramId } });

    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isTelegramVerified) {
      throw new BadRequestException("Telegram уже верифицирован");
    }

    if (!user.telegramVerificationCode) {
      throw new BadRequestException("Код верификации не найден");
    }

    if (
      user.telegramVerificationExpires &&
      user.telegramVerificationExpires < new Date()
    ) {
      throw new BadRequestException("Код верификации истек");
    }

    if (user.telegramVerificationCode !== code) {
      throw new BadRequestException("Неверный код верификации");
    }

    // Верифицируем telegram и очищаем код
    user.isTelegramVerified = true;
    user.telegramVerificationCode = null;
    user.telegramVerificationExpires = null;
    await this.userRepository.save(user);

    // Логируем верификацию Telegram
    this.activityLogService
      .create({
        type: ActivityType.USER_TELEGRAM_VERIFIED,
        level: ActivityLevel.SUCCESS,
        message: `Telegram пользователя ${user.firstName} ${user.lastName} (${user.telegramId}) верифицирован`,
        userId: user.id,
        metadata: {
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования верификации Telegram:", error);
      });

    // Отправляем приветственное сообщение
    await this.telegramValidationService.sendWelcomeMessage(
      telegramId,
      user.firstName
    );

    // Генерируем JWT токен для автоматического входа
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async resendVerificationCode(telegramId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { telegramId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isTelegramVerified) {
      throw new BadRequestException("Telegram уже верифицирован");
    }

    // Генерируем новый код
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    // СНАЧАЛА отправляем код в Telegram
    try {
      const sent = await this.telegramValidationService.sendVerificationCode(
        telegramId,
        verificationCode
      );
      if (!sent) {
        throw new Error("Не удалось отправить код в Telegram");
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки повторного кода в Telegram для ${telegramId}:`,
        error
      );
      throw new BadRequestException(
        `Не удалось отправить код верификации в Telegram. Проверьте правильность Telegram ID и убедитесь, что вы начали диалог с ботом.`
      );
    }

    // ТОЛЬКО ПОСЛЕ успешной отправки обновляем пользователя
    user.telegramVerificationCode = verificationCode;
    user.telegramVerificationExpires = verificationExpires;
    await this.userRepository.save(user);
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Пользователь не найден или неактивен");
    }

    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
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

    const updatedUser = await this.userRepository.save(user);

    // Логируем обновление профиля
    this.activityLogService
      .create({
        type: ActivityType.USER_UPDATED,
        level: ActivityLevel.INFO,
        message: `Пользователь ${updatedUser.firstName} ${updatedUser.lastName} обновил профиль`,
        userId: updatedUser.id,
        metadata: {
          action: "profile_update",
          changes: updateData,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования обновления профиля:", error);
      });

    return updatedUser;
  }

  /**
   * Завершает логин с проверкой 2FA
   */
  async completeLoginWithTwoFactor(
    userId: string,
    twoFactorCode: string
  ): Promise<{ user: User; accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Пользователь не найден или неактивен");
    }

    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException("Двухфакторная аутентификация не включена");
    }

    // Проверяем код 2FA
    const verificationResult = await this.twoFactorService.verifyTwoFactorCode(
      userId,
      twoFactorCode
    );

    if (!verificationResult.isValid) {
      throw new UnauthorizedException(
        "Неверный код двухфакторной аутентификации"
      );
    }

    // Обновляем время последнего входа
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Генерируем JWT токен
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    // Логируем выход пользователя
    this.activityLogService
      .create({
        type: ActivityType.USER_LOGOUT,
        level: ActivityLevel.INFO,
        message: `Пользователь ${user.firstName} ${user.lastName} (${user.telegramId}) вышел из системы`,
        userId: user.id,
        metadata: {
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования выхода:", error);
      });

    return { message: "Выход выполнен успешно" };
  }
}
