import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import * as speakeasy from "speakeasy";

import { User, TwoFactorType } from "../../database/entities/user.entity";
import { TelegramValidationService } from "../../common/telegram-validation.service";
import { ActivityLogService } from "../activity-log/activity-log.service";
import {
  ActivityType,
  ActivityLevel,
} from "../../database/entities/activity-log.entity";

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private telegramValidationService: TelegramValidationService,
    private activityLogService: ActivityLogService
  ) {}

  /**
   * Генерирует секрет для Google Authenticator
   */
  generateGoogleAuthenticatorSecret(userId: string): string {
    const secret = speakeasy.generateSecret({
      name: `BotManager`,
      issuer: "BotManager",
      length: 32,
    });
    return secret.base32;
  }

  /**
   * Генерирует резервные коды для восстановления доступа
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
  }

  /**
   * Включает 2FA для пользователя
   */
  async enableTwoFactor(
    userId: string,
    twoFactorType: TwoFactorType,
    verificationCode: string
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException(
        "Двухфакторная аутентификация уже включена"
      );
    }

    // Проверяем код верификации в зависимости от типа 2FA
    if (twoFactorType === TwoFactorType.GOOGLE_AUTHENTICATOR) {
      // Для Google Authenticator проверяем код через TOTP
      if (!user.twoFactorSecret) {
        throw new BadRequestException("Секрет 2FA не найден");
      }

      const isValidCode = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: verificationCode,
        window: 2, // Допускаем отклонение в 2 периода (60 секунд)
      });

      if (!isValidCode) {
        throw new BadRequestException(
          "Неверный код двухфакторной аутентификации"
        );
      }
    } else {
      // Для Telegram проверяем сохраненный код верификации
      if (
        !user.twoFactorVerificationCode ||
        user.twoFactorVerificationCode !== verificationCode ||
        !user.twoFactorVerificationExpires ||
        user.twoFactorVerificationExpires < new Date()
      ) {
        throw new BadRequestException("Неверный или истекший код верификации");
      }
    }

    // Генерируем резервные коды
    const backupCodes = this.generateBackupCodes();

    // Включаем 2FA
    user.isTwoFactorEnabled = true;
    user.twoFactorType = twoFactorType;
    user.twoFactorBackupCodes = JSON.stringify(backupCodes);
    user.twoFactorVerificationCode = null;
    user.twoFactorVerificationExpires = null;

    await this.userRepository.save(user);

    this.logger.log(
      `2FA включена для пользователя ${userId}, тип: ${twoFactorType}`
    );

    // Логируем включение 2FA
    this.activityLogService
      .create({
        type: ActivityType.USER_2FA_ENABLED,
        level: ActivityLevel.SUCCESS,
        message: `Включена двухфакторная аутентификация (${twoFactorType})`,
        userId,
        metadata: {
          twoFactorType,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования включения 2FA:", error);
      });

    return { backupCodes };
  }

  /**
   * Инициализирует отключение 2FA для Telegram (отправляет код подтверждения)
   */
  async initializeDisableTelegramTwoFactor(userId: string): Promise<{
    verificationCode: string;
    expiresAt: Date;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException("Двухфакторная аутентификация не включена");
    }

    if (user.twoFactorType !== TwoFactorType.TELEGRAM) {
      throw new BadRequestException("2FA не настроена через Telegram");
    }

    if (!user.telegramId) {
      throw new BadRequestException("Telegram ID не найден");
    }

    // Генерируем код верификации для отключения
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 минута

    // Отправляем код в Telegram
    try {
      const sent = await this.telegramValidationService.sendVerificationCode(
        user.telegramId,
        verificationCode
      );
      if (!sent) {
        throw new Error("Не удалось отправить код в Telegram");
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки кода отключения 2FA в Telegram для пользователя ${userId}:`,
        error
      );
      throw new BadRequestException("Не удалось отправить код в Telegram");
    }

    // Сохраняем временные данные для отключения
    user.twoFactorVerificationCode = verificationCode;
    user.twoFactorVerificationExpires = expiresAt;
    await this.userRepository.save(user);

    return { verificationCode, expiresAt };
  }

  /**
   * Отключает 2FA для пользователя
   */
  async disableTwoFactor(
    userId: string,
    verificationCode: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException("Двухфакторная аутентификация не включена");
    }

    // Для Telegram проверяем специальный код отключения
    if (user.twoFactorType === TwoFactorType.TELEGRAM) {
      if (
        !user.twoFactorVerificationCode ||
        !user.twoFactorVerificationExpires ||
        new Date() > user.twoFactorVerificationExpires ||
        user.twoFactorVerificationCode !== verificationCode
      ) {
        throw new BadRequestException(
          "Неверный или истекший код подтверждения отключения"
        );
      }
    } else {
      // Для Google Authenticator используем стандартную проверку
      const isValidCode = await this.verifyTwoFactorCode(
        userId,
        verificationCode
      );
      if (!isValidCode) {
        throw new BadRequestException(
          "Неверный код двухфакторной аутентификации"
        );
      }
    }

    // Отключаем 2FA
    user.isTwoFactorEnabled = false;
    user.twoFactorType = null;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;
    user.twoFactorVerificationCode = null;
    user.twoFactorVerificationExpires = null;

    await this.userRepository.save(user);

    this.logger.log(`2FA отключена для пользователя ${userId}`);

    // Логируем отключение 2FA
    this.activityLogService
      .create({
        type: ActivityType.USER_2FA_DISABLED,
        level: ActivityLevel.WARNING,
        message: `Отключена двухфакторная аутентификация`,
        userId,
        metadata: {
          previousTwoFactorType: user.twoFactorType,
        },
      })
      .catch((error) => {
        this.logger.error("Ошибка логирования отключения 2FA:", error);
      });
  }

  /**
   * Инициализирует настройку 2FA для Telegram
   */
  async initializeTelegramTwoFactor(userId: string): Promise<{
    verificationCode: string;
    expiresAt: Date;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (!user.telegramId) {
      throw new BadRequestException("Telegram ID не найден");
    }

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException(
        "Двухфакторная аутентификация уже включена"
      );
    }

    // Генерируем код верификации
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 минута

    // Отправляем код в Telegram
    try {
      const sent = await this.telegramValidationService.sendVerificationCode(
        user.telegramId,
        verificationCode
      );
      if (!sent) {
        throw new Error("Не удалось отправить код в Telegram");
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки кода 2FA в Telegram для ${user.telegramId}:`,
        error
      );
      throw new BadRequestException(
        "Не удалось отправить код верификации в Telegram. Проверьте правильность Telegram ID и убедитесь, что вы начали диалог с ботом."
      );
    }

    // Сохраняем код верификации
    user.twoFactorVerificationCode = verificationCode;
    user.twoFactorVerificationExpires = expiresAt;
    user.twoFactorType = TwoFactorType.TELEGRAM;
    await this.userRepository.save(user);

    return { verificationCode, expiresAt };
  }

  /**
   * Инициализирует настройку 2FA для Google Authenticator
   */
  async initializeGoogleAuthenticatorTwoFactor(userId: string): Promise<{
    secret: string;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    if (user.isTwoFactorEnabled) {
      throw new BadRequestException(
        "Двухфакторная аутентификация уже включена"
      );
    }

    // Генерируем секрет
    const secret = this.generateGoogleAuthenticatorSecret(userId);

    // Сохраняем временные данные (только секрет, код верификации не нужен)
    user.twoFactorSecret = secret;
    user.twoFactorType = TwoFactorType.GOOGLE_AUTHENTICATOR;
    await this.userRepository.save(user);

    return { secret };
  }

  /**
   * Проверяет код 2FA
   */
  async verifyTwoFactorCode(
    userId: string,
    code: string
  ): Promise<{ isValid: boolean; isBackupCode?: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isTwoFactorEnabled) {
      return { isValid: false };
    }

    // Проверяем резервные коды
    if (user.twoFactorBackupCodes) {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[];
      const backupCodeIndex = backupCodes.indexOf(code.toUpperCase());

      if (backupCodeIndex !== -1) {
        // Удаляем использованный резервный код
        backupCodes.splice(backupCodeIndex, 1);
        user.twoFactorBackupCodes = JSON.stringify(backupCodes);
        await this.userRepository.save(user);

        return { isValid: true, isBackupCode: true };
      }
    }

    // Проверяем код в зависимости от типа 2FA
    if (user.twoFactorType === TwoFactorType.GOOGLE_AUTHENTICATOR) {
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: code,
        window: 2, // Разрешаем отклонение в ±2 периода (60 секунд)
      });

      return { isValid };
    } else if (user.twoFactorType === TwoFactorType.TELEGRAM) {
      // Для Telegram используем временные коды (6-значные)
      const isValid = code.length === 6 && /^\d+$/.test(code);
      return { isValid };
    }

    return { isValid: false };
  }

  /**
   * Отправляет код 2FA в Telegram
   */
  async sendTelegramTwoFactorCode(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (
      !user ||
      !user.isTwoFactorEnabled ||
      user.twoFactorType !== TwoFactorType.TELEGRAM
    ) {
      throw new BadRequestException("2FA через Telegram не настроена");
    }

    if (!user.telegramId) {
      throw new BadRequestException("Telegram ID не найден");
    }

    // Генерируем новый код
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const sent = await this.telegramValidationService.sendVerificationCode(
        user.telegramId,
        code
      );
      if (!sent) {
        throw new Error("Не удалось отправить код в Telegram");
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки кода 2FA в Telegram для ${user.telegramId}:`,
        error
      );
      throw new BadRequestException(
        "Не удалось отправить код в Telegram. Проверьте правильность Telegram ID и убедитесь, что вы начали диалог с ботом."
      );
    }

    this.logger.log(`Код 2FA отправлен в Telegram для пользователя ${userId}`);
  }

  /**
   * Получает информацию о состоянии 2FA пользователя
   */
  async getTwoFactorStatus(userId: string): Promise<{
    isEnabled: boolean;
    type?: TwoFactorType;
    backupCodesCount?: number;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Пользователь не найден");
    }

    let backupCodesCount = 0;
    if (user.twoFactorBackupCodes) {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[];
      backupCodesCount = backupCodes.length;
    }

    return {
      isEnabled: user.isTwoFactorEnabled,
      type: user.twoFactorType,
      backupCodesCount,
    };
  }
}
