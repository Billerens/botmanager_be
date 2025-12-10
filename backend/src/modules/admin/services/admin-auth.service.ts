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
import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";

import {
  Admin,
  AdminRole,
  AdminStatus,
} from "../../../database/entities/admin.entity";
import {
  AdminActionType,
  AdminActionLevel,
} from "../../../database/entities/admin-action-log.entity";
import { AdminActionLogService } from "./admin-action-log.service";
import { AdminJwtPayload } from "../interfaces/admin-jwt-payload.interface";
import {
  AdminLoginDto,
  CreateAdminDto,
  UpdateAdminDto,
  ChangeAdminPasswordDto,
} from "../dto/admin.dto";
import {
  AdminLoginResponseDto,
  TwoFactorSetupResponseDto,
} from "../dto/admin-response.dto";

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  // Хранилище для отслеживания неудачных попыток входа
  private loginAttempts: Map<
    string,
    { count: number; lastAttempt: Date; lockedUntil?: Date }
  > = new Map();

  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private actionLogService: AdminActionLogService
  ) {}

  async login(
    loginDto: AdminLoginDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminLoginResponseDto | { requiresTwoFactor: boolean; adminId: string }> {
    const { username, password, twoFactorCode } = loginDto;

    // Проверяем блокировку по IP
    await this.checkLoginAttempts(username);

    // Находим админа
    const admin = await this.adminRepository.findOne({ where: { username } });
    if (!admin) {
      await this.recordFailedLogin(username, ipAddress, userAgent);
      throw new UnauthorizedException("Неверные учетные данные");
    }

    // Проверяем пароль
    const isPasswordValid = await admin.validatePassword(password);
    if (!isPasswordValid) {
      await this.recordFailedLogin(username, ipAddress, userAgent, admin.id);
      throw new UnauthorizedException("Неверные учетные данные");
    }

    // Проверяем активность
    if (!admin.isActive || admin.status === AdminStatus.INACTIVE) {
      throw new ForbiddenException("Аккаунт деактивирован");
    }

    // Проверяем 2FA
    if (admin.isTwoFactorEnabled) {
      if (!twoFactorCode) {
        return { requiresTwoFactor: true, adminId: admin.id };
      }

      const isCodeValid = this.verifyTwoFactorCode(admin, twoFactorCode);
      if (!isCodeValid) {
        await this.recordFailedLogin(username, ipAddress, userAgent, admin.id);
        throw new UnauthorizedException("Неверный код двухфакторной аутентификации");
      }
    }

    // Сбрасываем счетчик неудачных попыток
    this.loginAttempts.delete(username);

    // Проверяем истечение пароля
    const requiresPasswordChange = admin.isPasswordExpired;

    // Обновляем информацию о последнем входе
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = ipAddress;
    admin.lastActivityAt = new Date();
    await this.adminRepository.save(admin);

    // Генерируем JWT
    const payload: AdminJwtPayload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      isAdmin: true,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>(
        "admin.jwtSecret",
        "admin-super-secret-key-change-in-production"
      ),
      expiresIn: this.configService.get<string>("admin.jwtExpiresIn", "4h"),
    });

    // Логируем вход
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.LOGIN,
      level: AdminActionLevel.INFO,
      description: `Администратор ${admin.username} вошел в систему`,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      admin: admin as any,
      expiresIn: this.configService.get<string>("admin.jwtExpiresIn", "4h"),
      requiresPasswordChange,
    };
  }

  async logout(admin: Admin, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.LOGOUT,
      level: AdminActionLevel.INFO,
      description: `Администратор ${admin.username} вышел из системы`,
      ipAddress,
      userAgent,
    });
  }

  async createAdmin(
    createDto: CreateAdminDto,
    createdBy: Admin
  ): Promise<Admin> {
    // Проверяем права (только superadmin может создавать админов)
    if (createdBy.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException("Только суперадмин может создавать администраторов");
    }

    // Проверяем уникальность username
    const existingByUsername = await this.adminRepository.findOne({
      where: { username: createDto.username },
    });
    if (existingByUsername) {
      throw new ConflictException("Администратор с таким username уже существует");
    }

    // Проверяем уникальность telegramId
    const existingByTelegram = await this.adminRepository.findOne({
      where: { telegramId: createDto.telegramId },
    });
    if (existingByTelegram) {
      throw new ConflictException("Администратор с таким Telegram ID уже существует");
    }

    // Создаем админа
    const admin = this.adminRepository.create({
      ...createDto,
      role: createDto.role || AdminRole.SUPPORT,
      passwordRotationDays: createDto.passwordRotationDays || 30,
    });

    const savedAdmin = await this.adminRepository.save(admin);

    // Логируем создание
    await this.actionLogService.create({
      adminId: createdBy.id,
      actionType: AdminActionType.ADMIN_CREATE,
      level: AdminActionLevel.WARNING,
      description: `Создан новый администратор: ${savedAdmin.username}`,
      entityType: "admin",
      entityId: savedAdmin.id,
      newData: {
        username: savedAdmin.username,
        role: savedAdmin.role,
        telegramId: savedAdmin.telegramId,
      },
    });

    return savedAdmin;
  }

  async updateAdmin(
    adminId: string,
    updateDto: UpdateAdminDto,
    updatedBy: Admin
  ): Promise<Admin> {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new BadRequestException("Администратор не найден");
    }

    // Только superadmin может менять роли
    if (updateDto.role && updatedBy.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException("Только суперадмин может менять роли");
    }

    const previousData = { ...admin };

    // Обновляем поля
    Object.assign(admin, updateDto);
    const savedAdmin = await this.adminRepository.save(admin);

    // Логируем обновление
    await this.actionLogService.create({
      adminId: updatedBy.id,
      actionType: AdminActionType.ADMIN_UPDATE,
      level: AdminActionLevel.INFO,
      description: `Обновлен администратор: ${savedAdmin.username}`,
      entityType: "admin",
      entityId: savedAdmin.id,
      previousData: {
        firstName: previousData.firstName,
        lastName: previousData.lastName,
        role: previousData.role,
        status: previousData.status,
      },
      newData: updateDto,
    });

    return savedAdmin;
  }

  async changePassword(
    admin: Admin,
    changeDto: ChangeAdminPasswordDto,
    ipAddress?: string
  ): Promise<void> {
    // Если это не принудительная смена, проверяем текущий пароль
    if (changeDto.currentPassword) {
      const isValid = await admin.validatePassword(changeDto.currentPassword);
      if (!isValid) {
        throw new BadRequestException("Неверный текущий пароль");
      }
    }

    // Проверяем минимальную длину нового пароля
    const minLength = this.configService.get<number>(
      "admin.passwordMinLength",
      12
    );
    if (changeDto.newPassword.length < minLength) {
      throw new BadRequestException(
        `Пароль должен содержать минимум ${minLength} символов`
      );
    }

    // Обновляем пароль
    admin.password = changeDto.newPassword;
    admin.passwordChangedAt = new Date();
    admin.passwordExpiresAt = new Date(
      Date.now() + admin.passwordRotationDays * 24 * 60 * 60 * 1000
    );
    admin.status = AdminStatus.ACTIVE;

    await this.adminRepository.save(admin);

    // Логируем смену пароля
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.PASSWORD_CHANGED,
      level: AdminActionLevel.WARNING,
      description: `Администратор ${admin.username} сменил пароль`,
      ipAddress,
    });
  }

  async resetAdminPassword(
    adminId: string,
    resetBy: Admin
  ): Promise<string> {
    if (resetBy.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException("Только суперадмин может сбрасывать пароли");
    }

    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new BadRequestException("Администратор не найден");
    }

    // Генерируем новый пароль
    const newPassword = this.generateSecurePassword();

    admin.password = newPassword;
    admin.passwordChangedAt = new Date();
    admin.passwordExpiresAt = new Date(
      Date.now() + admin.passwordRotationDays * 24 * 60 * 60 * 1000
    );
    admin.status = AdminStatus.PENDING_PASSWORD_CHANGE;

    await this.adminRepository.save(admin);

    // Логируем сброс пароля
    await this.actionLogService.create({
      adminId: resetBy.id,
      actionType: AdminActionType.ADMIN_PASSWORD_RESET,
      level: AdminActionLevel.CRITICAL,
      description: `Суперадмин ${resetBy.username} сбросил пароль администратора ${admin.username}`,
      entityType: "admin",
      entityId: admin.id,
    });

    return newPassword;
  }

  async setupTwoFactor(admin: Admin): Promise<TwoFactorSetupResponseDto> {
    // Генерируем секрет
    const secret = speakeasy.generateSecret({
      name: `BotManager Admin (${admin.username})`,
      length: 32,
    });

    // Сохраняем секрет (но 2FA еще не активирована)
    admin.twoFactorSecret = secret.base32;
    await this.adminRepository.save(admin);

    // Генерируем QR код
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Генерируем резервные коды
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  async enableTwoFactor(admin: Admin, code: string): Promise<string[]> {
    if (!admin.twoFactorSecret) {
      throw new BadRequestException("Сначала нужно настроить 2FA");
    }

    // Верифицируем код
    const isValid = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException("Неверный код подтверждения");
    }

    // Генерируем и сохраняем резервные коды
    const backupCodes = this.generateBackupCodes();
    admin.twoFactorBackupCodes = JSON.stringify(backupCodes);
    admin.isTwoFactorEnabled = true;
    await this.adminRepository.save(admin);

    // Логируем
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.TWO_FACTOR_ENABLED,
      level: AdminActionLevel.WARNING,
      description: `Администратор ${admin.username} включил двухфакторную аутентификацию`,
    });

    return backupCodes;
  }

  async disableTwoFactor(admin: Admin, code: string): Promise<void> {
    if (!admin.isTwoFactorEnabled) {
      throw new BadRequestException("2FA не включена");
    }

    // Верифицируем код
    const isValid = this.verifyTwoFactorCode(admin, code);
    if (!isValid) {
      throw new BadRequestException("Неверный код подтверждения");
    }

    admin.isTwoFactorEnabled = false;
    admin.twoFactorSecret = null;
    admin.twoFactorBackupCodes = null;
    await this.adminRepository.save(admin);

    // Логируем
    await this.actionLogService.create({
      adminId: admin.id,
      actionType: AdminActionType.TWO_FACTOR_DISABLED,
      level: AdminActionLevel.WARNING,
      description: `Администратор ${admin.username} отключил двухфакторную аутентификацию`,
    });
  }

  async findAll(): Promise<Admin[]> {
    return this.adminRepository.find({
      order: { createdAt: "DESC" },
    });
  }

  async findById(id: string): Promise<Admin> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new BadRequestException("Администратор не найден");
    }
    return admin;
  }

  async deleteAdmin(adminId: string, deletedBy: Admin): Promise<void> {
    if (deletedBy.role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException("Только суперадмин может удалять администраторов");
    }

    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new BadRequestException("Администратор не найден");
    }

    if (admin.id === deletedBy.id) {
      throw new BadRequestException("Нельзя удалить самого себя");
    }

    await this.adminRepository.remove(admin);

    // Логируем удаление
    await this.actionLogService.create({
      adminId: deletedBy.id,
      actionType: AdminActionType.ADMIN_DELETE,
      level: AdminActionLevel.CRITICAL,
      description: `Суперадмин ${deletedBy.username} удалил администратора ${admin.username}`,
      entityType: "admin",
      entityId: adminId,
      previousData: {
        username: admin.username,
        role: admin.role,
      },
    });
  }

  // Приватные методы

  private verifyTwoFactorCode(admin: Admin, code: string): boolean {
    // Сначала проверяем TOTP код
    const isTotp = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (isTotp) return true;

    // Проверяем резервные коды
    if (admin.twoFactorBackupCodes) {
      const backupCodes: string[] = JSON.parse(admin.twoFactorBackupCodes);
      const codeIndex = backupCodes.indexOf(code);
      if (codeIndex !== -1) {
        // Удаляем использованный код
        backupCodes.splice(codeIndex, 1);
        admin.twoFactorBackupCodes = JSON.stringify(backupCodes);
        this.adminRepository.save(admin);
        return true;
      }
    }

    return false;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    return codes;
  }

  private generateSecurePassword(): string {
    const length = 16;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    return password;
  }

  private async checkLoginAttempts(username: string): Promise<void> {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) return;

    // Проверяем блокировку
    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (attempts.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new ForbiddenException(
        `Аккаунт временно заблокирован. Попробуйте через ${minutesLeft} минут`
      );
    }

    // Сбрасываем, если блокировка истекла
    if (attempts.lockedUntil && attempts.lockedUntil <= new Date()) {
      this.loginAttempts.delete(username);
    }
  }

  private async recordFailedLogin(
    username: string,
    ipAddress?: string,
    userAgent?: string,
    adminId?: string
  ): Promise<void> {
    const maxAttempts = this.configService.get<number>(
      "admin.maxLoginAttempts",
      5
    );
    const lockoutMinutes = this.configService.get<number>(
      "admin.lockoutDurationMinutes",
      30
    );

    const attempts = this.loginAttempts.get(username) || {
      count: 0,
      lastAttempt: new Date(),
    };

    attempts.count++;
    attempts.lastAttempt = new Date();

    if (attempts.count >= maxAttempts) {
      attempts.lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
    }

    this.loginAttempts.set(username, attempts);

    // Логируем неудачную попытку
    await this.actionLogService.create({
      adminId,
      actionType: AdminActionType.LOGIN_FAILED,
      level:
        attempts.count >= maxAttempts
          ? AdminActionLevel.CRITICAL
          : AdminActionLevel.WARNING,
      description: `Неудачная попытка входа для ${username} (попытка ${attempts.count}/${maxAttempts})`,
      metadata: { username, attemptCount: attempts.count },
      ipAddress,
      userAgent,
    });
  }
}

