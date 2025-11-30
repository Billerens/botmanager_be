import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import {
  BotInvitation,
  BotInvitationStatus,
} from "../../database/entities/bot-invitation.entity";
import { BotUser } from "../../database/entities/bot-user.entity";
import { User } from "../../database/entities/user.entity";
import { Bot } from "../../database/entities/bot.entity";
import {
  PermissionAction,
  BotEntity,
} from "../../database/entities/bot-user-permission.entity";
import { BotPermissionsService } from "./bot-permissions.service";
import { BotNotificationsService } from "./bot-notifications.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class BotInvitationsService {
  private readonly logger = new Logger(BotInvitationsService.name);

  constructor(
    @InjectRepository(BotInvitation)
    private botInvitationRepository: Repository<BotInvitation>,
    @InjectRepository(BotUser)
    private botUserRepository: Repository<BotUser>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    private botPermissionsService: BotPermissionsService,
    private botNotificationsService: BotNotificationsService
  ) {}

  /**
   * Создает приглашение для пользователя
   */
  async createInvitation(
    botId: string,
    invitedTelegramId: string,
    permissions: Record<BotEntity, PermissionAction[]>,
    invitedByUserId: string,
    message?: string
  ): Promise<BotInvitation> {
    // Проверяем, что бот существует и приглашающий имеет права
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем права приглашающего
    const canInvite = await this.botPermissionsService.hasPermission(
      invitedByUserId,
      botId,
      BotEntity.BOT_USERS,
      PermissionAction.CREATE
    );
    if (invitedByUserId !== bot.ownerId && !canInvite) {
      throw new BadRequestException(
        "Недостаточно прав для приглашения пользователей"
      );
    }

    // Проверяем существующие приглашения
    const existingInvitation = await this.botInvitationRepository.findOne({
      where: {
        botId,
        invitedTelegramId,
        status: BotInvitationStatus.PENDING,
      },
      order: { createdAt: "DESC" },
    });

    if (existingInvitation) {
      // Если приглашение создано более часа назад, отменяем его и создаем новое
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingInvitation.createdAt < oneHourAgo) {
        existingInvitation.status = BotInvitationStatus.EXPIRED;
        await this.botInvitationRepository.save(existingInvitation);
      } else {
        throw new BadRequestException("Пользователь уже приглашен в этот бот");
      }
    }

    // Проверяем, не добавлен ли уже этот пользователь
    const existingUser = await this.userRepository.findOne({
      where: { telegramId: invitedTelegramId },
    });
    if (existingUser) {
      const existingBotUser = await this.botUserRepository.findOne({
        where: { botId, userId: existingUser.id },
      });
      if (existingBotUser) {
        throw new BadRequestException("Пользователь уже добавлен к этому боту");
      }
    }

    // Создаем приглашение
    const invitation = this.botInvitationRepository.create({
      botId,
      invitedTelegramId,
      invitedUserId: existingUser?.id,
      permissions,
      invitedByUserId,
      invitationToken: uuidv4(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
    });

    const savedInvitation = await this.botInvitationRepository.save(invitation);

    // Загружаем приглашение с отношениями для отправки уведомления
    const invitationWithRelations = await this.botInvitationRepository.findOne({
      where: { id: savedInvitation.id },
      relations: ["bot", "invitedByUser"],
    });

    if (!invitationWithRelations) {
      throw new Error("Не удалось загрузить созданное приглашение");
    }

    // Отправляем уведомление в Telegram
    try {
      await this.botNotificationsService.sendInvitationNotification(
        invitationWithRelations,
        message
      );
    } catch (error) {
      this.logger.error(
        `Ошибка отправки приглашения пользователю ${invitedTelegramId} для бота ${botId}:`,
        error
      );
      // Если отправка уведомления не удалась, отменяем приглашение
      savedInvitation.status = BotInvitationStatus.EXPIRED;
      await this.botInvitationRepository.save(savedInvitation);
      throw new BadRequestException(
        "Не удалось отправить приглашение пользователю"
      );
    }

    return savedInvitation;
  }

  /**
   * Принимает приглашение
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    // Находим приглашение
    const invitation = await this.botInvitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["bot", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    // Проверяем статус
    if (invitation.status !== BotInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    // Проверяем срок действия
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = BotInvitationStatus.EXPIRED;
      await this.botInvitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истек");
    }

    // Проверяем, что пользователь соответствует приглашению
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    if (invitation.invitedTelegramId !== user.telegramId) {
      throw new BadRequestException(
        "Приглашение не предназначено для этого пользователя"
      );
    }

    // Проверяем, добавлен ли пользователь к боту
    let botUser = await this.botUserRepository.findOne({
      where: { botId: invitation.botId, userId },
    });

    if (!botUser) {
      // Добавляем пользователя к боту, если он еще не добавлен
      botUser = await this.botPermissionsService.addUserToBot(
        invitation.botId,
        userId,
        undefined,
        invitation.permissions
      );
    } else {
      // Если пользователь уже добавлен, обновляем его разрешения
      botUser.permissions = invitation.permissions;
      await this.botUserRepository.save(botUser);
    }

    // Устанавливаем разрешения (всегда, для синхронизации)
    await this.botPermissionsService.setBulkPermissions(
      invitation.botId,
      userId,
      invitation.permissions,
      invitation.invitedByUserId
    );

    // Обновляем статус приглашения
    invitation.status = BotInvitationStatus.ACCEPTED;
    await this.botInvitationRepository.save(invitation);

    // Отправляем уведомление пригласившему пользователю
    await this.botNotificationsService.sendInvitationAcceptedNotification(
      invitation
    );
  }

  /**
   * Отклоняет приглашение
   */
  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.botInvitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["bot", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    // Проверяем, что пользователь соответствует приглашению
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || invitation.invitedTelegramId !== user.telegramId) {
      throw new BadRequestException(
        "Приглашение не предназначено для этого пользователя"
      );
    }

    invitation.status = BotInvitationStatus.DECLINED;
    await this.botInvitationRepository.save(invitation);

    // Отправляем уведомление пригласившему пользователю
    await this.botNotificationsService.sendInvitationDeclinedNotification(
      invitation
    );
  }

  /**
   * Получает приглашения для бота
   */
  async getBotInvitations(
    botId: string,
    invitedByUserId: string
  ): Promise<BotInvitation[]> {
    // Проверяем права
    const canView = await this.botPermissionsService.hasPermission(
      invitedByUserId,
      botId,
      BotEntity.BOT_USERS,
      PermissionAction.READ
    );

    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (invitedByUserId !== bot?.ownerId && !canView) {
      throw new BadRequestException(
        "Недостаточно прав для просмотра приглашений"
      );
    }

    return await this.botInvitationRepository.find({
      where: { botId },
      relations: ["bot", "invitedByUser", "invitedUser"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Получает приглашения пользователя
   */
  async getUserInvitations(userId: string): Promise<BotInvitation[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.telegramId) {
      return [];
    }

    return await this.botInvitationRepository.find({
      where: { invitedTelegramId: user.telegramId },
      relations: ["bot", "invitedByUser"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Отменяет приглашение
   */
  async cancelInvitation(
    botId: string,
    invitationId: string,
    cancelledByUserId: string
  ): Promise<void> {
    const invitation = await this.botInvitationRepository.findOne({
      where: { id: invitationId, botId },
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    // Проверяем права
    const canCancel = await this.botPermissionsService.hasPermission(
      cancelledByUserId,
      botId,
      BotEntity.BOT_USERS,
      PermissionAction.DELETE
    );

    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (cancelledByUserId !== bot?.ownerId && !canCancel) {
      throw new BadRequestException("Недостаточно прав для отмены приглашения");
    }

    await this.botInvitationRepository.remove(invitation);
  }

  /**
   * Получить публичную информацию о приглашении по токену
   */
  async getInvitationByToken(token: string): Promise<any> {
    const invitation = await this.botInvitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["bot", "invitedByUser"],
    });

    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    // Проверяем статус
    if (invitation.status !== BotInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    // Проверяем срок действия
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = BotInvitationStatus.EXPIRED;
      await this.botInvitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истек");
    }

    // Возвращаем публичную информацию
    return {
      id: invitation.id,
      bot: {
        id: invitation.bot.id,
        name: invitation.bot.name,
        username: invitation.bot.username,
      },
      invitedByUser: {
        firstName: invitation.invitedByUser?.firstName,
        lastName: invitation.invitedByUser?.lastName,
      },
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /**
   * Очищает истекшие приглашения
   */
  async cleanupExpiredInvitations(): Promise<void> {
    await this.botInvitationRepository.update(
      {
        status: BotInvitationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: BotInvitationStatus.EXPIRED }
    );
  }
}
