import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";

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
import { PasswordRotationService } from "./password-rotation.service";
import { TelegramValidationService } from "../../../common/telegram-validation.service";

export interface AdminCommand {
  command: string;
  args: string[];
  telegramId: string;
  chatId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
}

@Injectable()
export class AdminTelegramService {
  private readonly logger = new Logger(AdminTelegramService.name);
  private readonly managerTelegramIds: string[];

  constructor(
    private configService: ConfigService,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private actionLogService: AdminActionLogService,
    private passwordRotationService: PasswordRotationService,
    private telegramService: TelegramValidationService
  ) {
    // Загружаем список ID пользователей, которые могут управлять админами
    const managerIds = this.configService.get<string>(
      "ADMIN_MANAGER_TELEGRAM_IDS",
      ""
    );
    this.managerTelegramIds = managerIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    this.logger.log(
      `Telegram ID с правами управления админами: ${this.managerTelegramIds.join(", ") || "не заданы"}`
    );
  }

  /**
   * Проверяет, может ли пользователь управлять администраторами
   */
  canManageAdmins(telegramId: string): boolean {
    return this.managerTelegramIds.includes(telegramId);
  }

  /**
   * Обрабатывает команду для управления админами
   */
  async handleCommand(cmd: AdminCommand): Promise<string> {
    const { command, args, telegramId, chatId } = cmd;

    // Проверяем права на управление
    if (!this.canManageAdmins(telegramId)) {
      // Проверяем, может ли пользователь запросить свой пароль
      if (command === "/admin_mypassword") {
        return this.handleMyPasswordCommand(telegramId, chatId);
      }

      this.logger.warn(
        `Попытка доступа к админ-командам от неавторизованного пользователя: ${telegramId}`
      );
      return "⛔ У вас нет прав для управления администраторами.";
    }

    this.logger.log(
      `Админ-команда от ${telegramId}: ${command} ${args.join(" ")}`
    );

    switch (command) {
      case "/admin_help":
        return this.getHelpMessage();

      case "/admin_list":
        return this.handleListCommand();

      case "/admin_create":
        return this.handleCreateCommand(args, telegramId, chatId, cmd);

      case "/admin_delete":
        return this.handleDeleteCommand(args, telegramId);

      case "/admin_rotate":
        return this.handleRotateCommand(args, telegramId);

      case "/admin_info":
        return this.handleInfoCommand(args);

      case "/admin_block":
        return this.handleBlockCommand(args, telegramId);

      case "/admin_unblock":
        return this.handleUnblockCommand(args, telegramId);

      case "/admin_setrole":
        return this.handleSetRoleCommand(args, telegramId);

      case "/admin_mypassword":
        return this.handleMyPasswordCommand(telegramId, chatId);

      default:
        return `❓ Неизвестная команда: ${command}\n\nИспользуйте /admin_help для справки.`;
    }
  }

  /**
   * Справка по командам
   */
  private getHelpMessage(): string {
    return `🔐 *Управление администраторами*

*Доступные команды:*

📋 */admin\\_list* - Список всех администраторов

➕ */admin\\_create* _username firstName lastName telegramId [role]_
Создать нового администратора
• role: superadmin, support, viewer (по умолчанию: support)

🔍 */admin\\_info* _username или telegramId_
Информация об администраторе

🔄 */admin\\_rotate* _username или telegramId_
Принудительная ротация пароля

🚫 */admin\\_block* _username или telegramId_
Заблокировать администратора

✅ */admin\\_unblock* _username или telegramId_
Разблокировать администратора

👑 */admin\\_setrole* _username role_
Изменить роль (superadmin/support/viewer)

❌ */admin\\_delete* _username или telegramId_
Удалить администратора

🔑 */admin\\_mypassword*
Запросить свой пароль (если вы получатель)

_Пример создания:_
\`/admin_create john Иван Иванов 123456789 support\``;
  }

  /**
   * Список администраторов
   */
  private async handleListCommand(): Promise<string> {
    const admins = await this.adminRepository.find({
      order: { createdAt: "DESC" },
    });

    if (admins.length === 0) {
      return "📋 Администраторов пока нет.";
    }

    const lines = admins.map((admin) => {
      const statusIcon = admin.isActive ? "✅" : "🚫";
      const roleIcon =
        admin.role === AdminRole.SUPERADMIN
          ? "👑"
          : admin.role === AdminRole.SUPPORT
            ? "🛠"
            : "👁";

      const daysLeft = admin.daysUntilPasswordExpires;
      const passwordWarning = daysLeft <= 3 ? ` ⚠️${daysLeft}д` : "";

      return `${statusIcon} ${roleIcon} *${admin.username}*
   ${admin.firstName} ${admin.lastName}
   TG: \`${admin.telegramId}\`${passwordWarning}`;
    });

    return `📋 *Администраторы (${admins.length}):*\n\n${lines.join("\n\n")}`;
  }

  /**
   * Создание нового администратора
   */
  private async handleCreateCommand(
    args: string[],
    managerTelegramId: string,
    chatId: number,
    cmd: AdminCommand
  ): Promise<string> {
    // /admin_create username firstName lastName telegramId [role]
    if (args.length < 4) {
      return `❌ Недостаточно параметров.

*Использование:*
\`/admin_create username firstName lastName telegramId [role]\`

*Пример:*
\`/admin_create john Иван Иванов 123456789 support\``;
    }

    const [username, firstName, lastName, telegramId, roleStr] = args;
    const role = this.parseRole(roleStr) || AdminRole.SUPPORT;

    // Проверяем уникальность
    const existingByUsername = await this.adminRepository.findOne({
      where: { username },
    });
    if (existingByUsername) {
      return `❌ Администратор с username "${username}" уже существует.`;
    }

    const existingByTelegram = await this.adminRepository.findOne({
      where: { telegramId },
    });
    if (existingByTelegram) {
      return `❌ Администратор с Telegram ID "${telegramId}" уже существует.`;
    }

    // Генерируем пароль
    const password = this.generateSecurePassword();

    // Создаем админа
    const admin = this.adminRepository.create({
      username,
      password,
      firstName,
      lastName,
      telegramId,
      role,
      status: AdminStatus.ACTIVE,
      isActive: true,
      passwordRotationDays: 30,
      // Пароль получает создатель (менеджер)
      passwordRecipientTelegramId: managerTelegramId,
    });

    await this.adminRepository.save(admin);

    // Логируем создание
    await this.actionLogService.create({
      actionType: AdminActionType.ADMIN_CREATE,
      level: AdminActionLevel.WARNING,
      description: `Создан администратор ${username} через Telegram`,
      entityType: "admin",
      entityId: admin.id,
      metadata: {
        createdBy: managerTelegramId,
        username,
        role,
        telegramId,
      },
    });

    this.logger.log(
      `Администратор ${username} создан через Telegram пользователем ${managerTelegramId}`
    );

    // Отправляем пароль отдельным сообщением
    await this.telegramService.sendMessage(
      managerTelegramId,
      `🔐 *Пароль для ${username}:*\n\n\`${password}\`\n\n⚠️ Сохраните пароль! Это сообщение можно удалить.`,
      { parse_mode: "Markdown" }
    );

    const roleLabel =
      role === AdminRole.SUPERADMIN
        ? "Супер-админ 👑"
        : role === AdminRole.SUPPORT
          ? "Поддержка 🛠"
          : "Наблюдатель 👁";

    return `✅ *Администратор создан!*

👤 *Username:* \`${username}\`
📛 *Имя:* ${firstName} ${lastName}
📱 *Telegram ID:* \`${telegramId}\`
👑 *Роль:* ${roleLabel}

🔐 Пароль отправлен отдельным сообщением.

🌐 *Вход в админку:*
${this.configService.get("app.frontendUrl")}/admin/login`;
  }

  /**
   * Удаление администратора
   */
  private async handleDeleteCommand(
    args: string[],
    managerTelegramId: string
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Укажите username или telegramId администратора.";
    }

    const identifier = args[0];
    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    // Нельзя удалить самого себя через Telegram ID менеджера
    // (Менеджер может и не быть админом, но на всякий случай)

    const adminData = {
      username: admin.username,
      telegramId: admin.telegramId,
      role: admin.role,
    };

    await this.adminRepository.remove(admin);

    // Логируем удаление
    await this.actionLogService.create({
      actionType: AdminActionType.ADMIN_DELETE,
      level: AdminActionLevel.CRITICAL,
      description: `Удален администратор ${adminData.username} через Telegram`,
      entityType: "admin",
      metadata: {
        deletedBy: managerTelegramId,
        ...adminData,
      },
    });

    return `✅ Администратор *${adminData.username}* удален.`;
  }

  /**
   * Ротация пароля
   */
  private async handleRotateCommand(
    args: string[],
    managerTelegramId: string
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Укажите username или telegramId администратора.";
    }

    const identifier = args[0];
    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    // Выполняем ротацию
    await this.passwordRotationService.rotatePassword(admin);

    return `✅ Пароль для *${admin.username}* изменен и отправлен получателю.`;
  }

  /**
   * Информация об администраторе
   */
  private async handleInfoCommand(args: string[]): Promise<string> {
    if (args.length < 1) {
      return "❌ Укажите username или telegramId администратора.";
    }

    const identifier = args[0];
    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    const statusIcon = admin.isActive ? "✅ Активен" : "🚫 Заблокирован";
    const roleLabel =
      admin.role === AdminRole.SUPERADMIN
        ? "👑 Супер-админ"
        : admin.role === AdminRole.SUPPORT
          ? "🛠 Поддержка"
          : "👁 Наблюдатель";

    const daysLeft = admin.daysUntilPasswordExpires;
    const passwordStatus =
      daysLeft <= 0
        ? "🔴 Истек"
        : daysLeft <= 3
          ? `🟡 ${daysLeft} дн.`
          : `🟢 ${daysLeft} дн.`;

    const lastLogin = admin.lastLoginAt
      ? new Date(admin.lastLoginAt).toLocaleString("ru-RU")
      : "Никогда";

    return `📋 *Администратор: ${admin.username}*

👤 *Имя:* ${admin.firstName} ${admin.lastName}
📱 *Telegram ID:* \`${admin.telegramId}\`
${admin.telegramUsername ? `📲 *Username:* @${admin.telegramUsername}` : ""}

👑 *Роль:* ${roleLabel}
📊 *Статус:* ${statusIcon}
🔐 *2FA:* ${admin.isTwoFactorEnabled ? "✅ Включена" : "❌ Выключена"}

🔑 *Пароль:* ${passwordStatus}
🔄 *Ротация:* каждые ${admin.passwordRotationDays} дней
📬 *Получатель пароля:* \`${admin.passwordRecipientTelegramId || admin.telegramId}\`

🕐 *Последний вход:* ${lastLogin}
📅 *Создан:* ${new Date(admin.createdAt).toLocaleString("ru-RU")}`;
  }

  /**
   * Блокировка администратора
   */
  private async handleBlockCommand(
    args: string[],
    managerTelegramId: string
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Укажите username или telegramId администратора.";
    }

    const identifier = args[0];
    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    admin.isActive = false;
    admin.status = AdminStatus.INACTIVE;
    await this.adminRepository.save(admin);

    // Логируем
    await this.actionLogService.create({
      actionType: AdminActionType.ADMIN_UPDATE,
      level: AdminActionLevel.WARNING,
      description: `Администратор ${admin.username} заблокирован через Telegram`,
      entityType: "admin",
      entityId: admin.id,
      metadata: { blockedBy: managerTelegramId },
    });

    return `🚫 Администратор *${admin.username}* заблокирован.`;
  }

  /**
   * Разблокировка администратора
   */
  private async handleUnblockCommand(
    args: string[],
    managerTelegramId: string
  ): Promise<string> {
    if (args.length < 1) {
      return "❌ Укажите username или telegramId администратора.";
    }

    const identifier = args[0];
    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    admin.isActive = true;
    admin.status = AdminStatus.ACTIVE;
    await this.adminRepository.save(admin);

    // Логируем
    await this.actionLogService.create({
      actionType: AdminActionType.ADMIN_UPDATE,
      level: AdminActionLevel.INFO,
      description: `Администратор ${admin.username} разблокирован через Telegram`,
      entityType: "admin",
      entityId: admin.id,
      metadata: { unblockedBy: managerTelegramId },
    });

    return `✅ Администратор *${admin.username}* разблокирован.`;
  }

  /**
   * Изменение роли
   */
  private async handleSetRoleCommand(
    args: string[],
    managerTelegramId: string
  ): Promise<string> {
    if (args.length < 2) {
      return `❌ Укажите username и роль.

*Использование:*
\`/admin_setrole username role\`

*Роли:* superadmin, support, viewer`;
    }

    const [identifier, roleStr] = args;
    const role = this.parseRole(roleStr);

    if (!role) {
      return `❌ Неизвестная роль: ${roleStr}\n\n*Доступные роли:* superadmin, support, viewer`;
    }

    const admin = await this.findAdminByIdentifier(identifier);

    if (!admin) {
      return `❌ Администратор "${identifier}" не найден.`;
    }

    const previousRole = admin.role;
    admin.role = role;
    await this.adminRepository.save(admin);

    // Логируем
    await this.actionLogService.create({
      actionType: AdminActionType.ADMIN_UPDATE,
      level: AdminActionLevel.WARNING,
      description: `Изменена роль администратора ${admin.username}: ${previousRole} → ${role}`,
      entityType: "admin",
      entityId: admin.id,
      metadata: {
        changedBy: managerTelegramId,
        previousRole,
        newRole: role,
      },
    });

    const roleLabel =
      role === AdminRole.SUPERADMIN
        ? "👑 Супер-админ"
        : role === AdminRole.SUPPORT
          ? "🛠 Поддержка"
          : "👁 Наблюдатель";

    return `✅ Роль администратора *${admin.username}* изменена на ${roleLabel}.`;
  }

  /**
   * Запрос своего пароля (для получателей паролей)
   */
  private async handleMyPasswordCommand(
    telegramId: string,
    chatId: number
  ): Promise<string> {
    // Ищем админа, для которого этот пользователь - получатель пароля
    const admin = await this.adminRepository.findOne({
      where: { passwordRecipientTelegramId: telegramId },
    });

    if (!admin) {
      // Может быть, это сам админ
      const selfAdmin = await this.adminRepository.findOne({
        where: { telegramId },
      });

      if (selfAdmin) {
        // Выполняем ротацию и отправляем новый пароль
        await this.passwordRotationService.rotatePassword(selfAdmin);
        return `🔐 Новый пароль сгенерирован и отправлен вам!`;
      }

      return `❌ Вы не являетесь получателем пароля ни для одного администратора.`;
    }

    // Выполняем ротацию пароля
    await this.passwordRotationService.rotatePassword(admin);

    return `🔐 Новый пароль для *${admin.username}* сгенерирован и отправлен!`;
  }

  // Вспомогательные методы

  private async findAdminByIdentifier(
    identifier: string
  ): Promise<Admin | null> {
    // Ищем по username или telegramId
    return this.adminRepository.findOne({
      where: [{ username: identifier }, { telegramId: identifier }],
    });
  }

  private parseRole(roleStr?: string): AdminRole | null {
    if (!roleStr) return null;

    const normalized = roleStr.toLowerCase();
    switch (normalized) {
      case "superadmin":
      case "super":
        return AdminRole.SUPERADMIN;
      case "support":
        return AdminRole.SUPPORT;
      case "viewer":
      case "view":
        return AdminRole.VIEWER;
      default:
        return null;
    }
  }

  private generateSecurePassword(): string {
    const length = 16;
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*";

    const allChars = lowercase + uppercase + numbers + special;

    let password = "";
    // Гарантируем наличие символов каждого типа
    password += lowercase[crypto.randomInt(0, lowercase.length)];
    password += uppercase[crypto.randomInt(0, uppercase.length)];
    password += numbers[crypto.randomInt(0, numbers.length)];
    password += special[crypto.randomInt(0, special.length)];

    for (let i = 4; i < length; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }

    // Перемешиваем
    return password
      .split("")
      .sort(() => crypto.randomInt(-1, 2))
      .join("");
  }
}
