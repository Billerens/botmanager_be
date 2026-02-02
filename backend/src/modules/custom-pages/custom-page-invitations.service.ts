import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import {
  CustomPageInvitation,
  CustomPageInvitationStatus,
} from "../../database/entities/custom-page-invitation.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { User } from "../../database/entities/user.entity";
import { CustomPageEntity } from "../../database/entities/custom-page-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { CustomPagePermissionsService } from "./custom-page-permissions.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class CustomPageInvitationsService {
  private readonly logger = new Logger(CustomPageInvitationsService.name);

  constructor(
    @InjectRepository(CustomPageInvitation)
    private invitationRepository: Repository<CustomPageInvitation>,
    @InjectRepository(CustomPage)
    private customPageRepository: Repository<CustomPage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private customPagePermissionsService: CustomPagePermissionsService
  ) {}

  async createInvitation(
    customPageId: string,
    invitedTelegramId: string,
    permissions: Record<CustomPageEntity, PermissionAction[]>,
    invitedByUserId: string,
    message?: string
  ): Promise<CustomPageInvitation> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId },
    });
    if (!page) {
      throw new NotFoundException("Кастомная страница не найдена");
    }

    if (page.ownerId !== invitedByUserId) {
      const canInvite = await this.customPagePermissionsService.hasPermission(
        invitedByUserId,
        customPageId,
        CustomPageEntity.CUSTOM_PAGE_USERS,
        PermissionAction.CREATE
      );
      if (!canInvite) {
        throw new BadRequestException(
          "Недостаточно прав для приглашения пользователей"
        );
      }
    }

    const existingPending = await this.invitationRepository.findOne({
      where: {
        customPageId,
        invitedTelegramId,
        status: CustomPageInvitationStatus.PENDING,
      },
      order: { createdAt: "DESC" },
    });

    if (existingPending) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingPending.createdAt < oneHourAgo) {
        existingPending.status = CustomPageInvitationStatus.EXPIRED;
        await this.invitationRepository.save(existingPending);
      } else {
        throw new BadRequestException(
          "Пользователь уже приглашён на эту страницу"
        );
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { telegramId: invitedTelegramId },
    });
    if (existingUser) {
      const hasAccess =
        await this.customPagePermissionsService.hasAccessToCustomPage(
          existingUser.id,
          customPageId
        );
      if (hasAccess) {
        throw new BadRequestException(
          "Пользователь уже имеет доступ к этой странице"
        );
      }
    }

    const invitation = this.invitationRepository.create({
      customPageId,
      invitedTelegramId,
      invitedUserId: existingUser?.id,
      permissions,
      invitedByUserId,
      invitationToken: uuidv4(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return this.invitationRepository.save(invitation);
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["customPage", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== CustomPageInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = CustomPageInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истёк");
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }
    if (invitation.invitedTelegramId !== user.telegramId) {
      throw new BadRequestException(
        "Приглашение не предназначено для этого пользователя"
      );
    }

    const hasAccess =
      await this.customPagePermissionsService.hasAccessToCustomPage(
        userId,
        invitation.customPageId
      );
    if (!hasAccess) {
      await this.customPagePermissionsService.addUserToCustomPage(
        invitation.customPageId,
        userId,
        undefined,
        invitation.permissions
      );
    }

    invitation.status = CustomPageInvitationStatus.ACCEPTED;
    invitation.invitedUserId = userId;
    await this.invitationRepository.save(invitation);
  }

  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["customPage", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || invitation.invitedTelegramId !== user.telegramId) {
      throw new BadRequestException(
        "Приглашение не предназначено для этого пользователя"
      );
    }

    invitation.status = CustomPageInvitationStatus.DECLINED;
    await this.invitationRepository.save(invitation);
  }

  async getPageInvitations(
    customPageId: string,
    requestedByUserId: string
  ): Promise<CustomPageInvitation[]> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId },
    });
    if (!page) {
      throw new NotFoundException("Кастомная страница не найдена");
    }

    if (page.ownerId !== requestedByUserId) {
      const canView = await this.customPagePermissionsService.hasPermission(
        requestedByUserId,
        customPageId,
        CustomPageEntity.CUSTOM_PAGE_USERS,
        PermissionAction.READ
      );
      if (!canView) {
        throw new BadRequestException(
          "Недостаточно прав для просмотра приглашений"
        );
      }
    }

    return this.invitationRepository.find({
      where: { customPageId },
      relations: ["customPage", "invitedByUser", "invitedUser"],
      order: { createdAt: "DESC" },
    });
  }

  async getUserInvitations(userId: string): Promise<CustomPageInvitation[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.telegramId) {
      return [];
    }

    return this.invitationRepository.find({
      where: { invitedTelegramId: user.telegramId },
      relations: ["customPage", "invitedByUser"],
      order: { createdAt: "DESC" },
    });
  }

  async cancelInvitation(
    customPageId: string,
    invitationId: string,
    cancelledByUserId: string
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, customPageId },
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    const page = await this.customPageRepository.findOne({
      where: { id: customPageId },
    });
    if (!page) {
      throw new NotFoundException("Кастомная страница не найдена");
    }

    if (page.ownerId !== cancelledByUserId) {
      const canCancel = await this.customPagePermissionsService.hasPermission(
        cancelledByUserId,
        customPageId,
        CustomPageEntity.CUSTOM_PAGE_USERS,
        PermissionAction.DELETE
      );
      if (!canCancel) {
        throw new BadRequestException(
          "Недостаточно прав для отмены приглашения"
        );
      }
    }

    await this.invitationRepository.remove(invitation);
  }

  async getInvitationByToken(token: string): Promise<{
    id: string;
    customPage: { id: string; title: string };
    invitedByUser: { firstName?: string; lastName?: string };
    permissions: Record<CustomPageEntity, PermissionAction[]>;
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["customPage", "invitedByUser"],
    });

    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== CustomPageInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = CustomPageInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истёк");
    }

    return {
      id: invitation.id,
      customPage: {
        id: invitation.customPage.id,
        title: invitation.customPage.title,
      },
      invitedByUser: {
        firstName: invitation.invitedByUser?.firstName,
        lastName: invitation.invitedByUser?.lastName,
      },
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt ?? null,
      createdAt: invitation.createdAt,
    };
  }

  async cleanupExpiredInvitations(): Promise<void> {
    await this.invitationRepository.update(
      {
        status: CustomPageInvitationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: CustomPageInvitationStatus.EXPIRED }
    );
  }
}
