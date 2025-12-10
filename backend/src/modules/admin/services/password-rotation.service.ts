import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import * as crypto from "crypto";

import { Admin, AdminStatus } from "../../../database/entities/admin.entity";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";
import { AdminActionLogService } from "./admin-action-log.service";
import { TelegramValidationService } from "../../../common/telegram-validation.service";

@Injectable()
export class PasswordRotationService {
  private readonly logger = new Logger(PasswordRotationService.name);

  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private actionLogService: AdminActionLogService,
    private telegramService: TelegramValidationService
  ) {}

  /**
   * Запускается каждый день в 9:00 для проверки истекающих паролей
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkPasswordExpiration(): Promise<void> {
    this.logger.log("Проверка истечения паролей администраторов...");

    try {
      // Находим админов, у которых пароль истекает в течение 3 дней
      const warningDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const admins = await this.adminRepository.find({
        where: {
          isActive: true,
          passwordExpiresAt: LessThan(warningDate),
        },
      });

      for (const admin of admins) {
        // Если пароль уже истек - выполняем ротацию
        if (admin.isPasswordExpired) {
          await this.rotatePassword(admin);
        } else {
          // Отправляем предупреждение
          await this.sendExpirationWarning(admin);
        }
      }

      this.logger.log(`Проверено ${admins.length} администраторов`);
    } catch (error) {
      this.logger.error("Ошибка проверки паролей:", error);
    }
  }

  /**
   * Ротация пароля для конкретного администратора
   */
  async rotatePassword(admin: Admin): Promise<string> {
    this.logger.log(`Ротация пароля для администратора: ${admin.username}`);

    // Генерируем новый пароль
    const newPassword = this.generateSecurePassword();

    // Обновляем пароль
    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    admin.passwordExpiresAt = new Date(
      Date.now() + admin.passwordRotationDays * 24 * 60 * 60 * 1000
    );
    admin.status = AdminStatus.PENDING_PASSWORD_CHANGE;

    await this.adminRepository.save(admin);

    // Логируем ротацию
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.PASSWORD_CHANGED,
      level: AdminActionLevel.WARNING,
      description: `Автоматическая ротация пароля для ${admin.username}`,
      metadata: {
        reason: "password_expired",
        rotationDays: admin.passwordRotationDays,
      },
    });

    // Отправляем новый пароль получателю
    await this.sendNewPassword(admin, newPassword);

    return newPassword;
  }

  /**
   * Ручной запрос ротации пароля (например, по команде в Telegram)
   */
  async requestPasswordRotation(
    telegramId: string
  ): Promise<{ success: boolean; message: string }> {
    // Ищем админа, для которого этот телеграм ID указан как получатель пароля
    const admin = await this.adminRepository.findOne({
      where: { passwordRecipientTelegramId: telegramId },
    });

    if (!admin) {
      return {
        success: false,
        message: "Вы не являетесь получателем пароля ни для одного администратора",
      };
    }

    // Выполняем ротацию
    const newPassword = await this.rotatePassword(admin);

    return {
      success: true,
      message: `Пароль успешно изменен и отправлен`,
    };
  }

  /**
   * Обновление настроек ротации для админа
   */
  async updateRotationSettings(
    adminId: string,
    rotationDays: number,
    recipientTelegramId: string
  ): Promise<Admin> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new Error("Администратор не найден");
    }

    admin.passwordRotationDays = rotationDays;
    admin.passwordRecipientTelegramId = recipientTelegramId;

    // Пересчитываем дату истечения пароля
    if (admin.passwordChangedAt) {
      admin.passwordExpiresAt = new Date(
        admin.passwordChangedAt.getTime() + rotationDays * 24 * 60 * 60 * 1000
      );
    }

    return this.adminRepository.save(admin);
  }

  /**
   * Получение информации о ротации для всех админов
   */
  async getRotationStatus(): Promise<
    {
      adminId: string;
      username: string;
      daysUntilExpiration: number;
      recipientTelegramId: string;
      rotationDays: number;
    }[]
  > {
    const admins = await this.adminRepository.find({
      where: { isActive: true },
    });

    return admins.map((admin) => ({
      adminId: admin.id,
      username: admin.username,
      daysUntilExpiration: admin.daysUntilPasswordExpires,
      recipientTelegramId: admin.passwordRecipientTelegramId,
      rotationDays: admin.passwordRotationDays,
    }));
  }

  // Приватные методы

  private generateSecurePassword(): string {
    const length = 20;
    // Включаем все необходимые символы для сложного пароля
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    const allChars = lowercase + uppercase + numbers + special;

    // Гарантируем наличие как минимум одного символа каждого типа
    let password = "";
    password += lowercase[crypto.randomInt(0, lowercase.length)];
    password += uppercase[crypto.randomInt(0, uppercase.length)];
    password += numbers[crypto.randomInt(0, numbers.length)];
    password += special[crypto.randomInt(0, special.length)];

    // Добавляем остальные символы
    for (let i = 4; i < length; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }

    // Перемешиваем пароль
    return password
      .split("")
      .sort(() => crypto.randomInt(-1, 2))
      .join("");
  }

  private async sendNewPassword(admin: Admin, password: string): Promise<void> {
    const recipientId = admin.passwordRecipientTelegramId || admin.telegramId;

    if (!recipientId) {
      this.logger.warn(
        `Не указан получатель пароля для администратора ${admin.username}`
      );
      return;
    }

    const message = `🔐 *Новый пароль администратора*

👤 *Администратор:* ${admin.username}
📧 *Полное имя:* ${admin.fullName}

🔑 *Новый пароль:*
\`${password}\`

⚠️ *Важно:*
• Этот пароль действителен ${admin.passwordRotationDays} дней
• При первом входе рекомендуется сменить пароль
• Не передавайте пароль третьим лицам
• Сообщение можно удалить после сохранения пароля

📅 *Следующая ротация:* через ${admin.passwordRotationDays} дней`;

    try {
      await this.telegramService.sendMessage(recipientId, message, {
        parse_mode: "Markdown",
      });
      this.logger.log(
        `Пароль отправлен получателю ${recipientId} для админа ${admin.username}`
      );
    } catch (error) {
      this.logger.error(
        `Ошибка отправки пароля для ${admin.username}:`,
        error
      );
    }
  }

  private async sendExpirationWarning(admin: Admin): Promise<void> {
    const recipientId = admin.passwordRecipientTelegramId || admin.telegramId;

    if (!recipientId) {
      return;
    }

    const daysLeft = admin.daysUntilPasswordExpires;

    const message = `⚠️ *Предупреждение о истечении пароля*

👤 *Администратор:* ${admin.username}
⏰ *Пароль истекает через:* ${daysLeft} ${this.getDaysWord(daysLeft)}

🔄 Пароль будет автоматически изменен после истечения срока.
Новый пароль будет отправлен в это сообщение.

💡 Вы можете сменить пароль самостоятельно в настройках админ-панели.`;

    try {
      await this.telegramService.sendMessage(recipientId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      this.logger.error(
        `Ошибка отправки предупреждения для ${admin.username}:`,
        error
      );
    }
  }

  private getDaysWord(days: number): string {
    if (days === 1) return "день";
    if (days >= 2 && days <= 4) return "дня";
    return "дней";
  }
}

