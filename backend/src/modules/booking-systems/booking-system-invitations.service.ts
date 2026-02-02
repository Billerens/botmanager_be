import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import {
  BookingSystemInvitation,
  BookingSystemInvitationStatus,
} from "../../database/entities/booking-system-invitation.entity";
import { BookingSystem } from "../../database/entities/booking-system.entity";
import { User } from "../../database/entities/user.entity";
import { BookingEntity } from "../../database/entities/booking-system-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { BookingSystemPermissionsService } from "./booking-system-permissions.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class BookingSystemInvitationsService {
  private readonly logger = new Logger(BookingSystemInvitationsService.name);

  constructor(
    @InjectRepository(BookingSystemInvitation)
    private invitationRepository: Repository<BookingSystemInvitation>,
    @InjectRepository(BookingSystem)
    private bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private bookingSystemPermissionsService: BookingSystemPermissionsService
  ) {}

  async createInvitation(
    bookingSystemId: string,
    invitedTelegramId: string,
    permissions: Record<BookingEntity, PermissionAction[]>,
    invitedByUserId: string,
    message?: string
  ): Promise<BookingSystemInvitation> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    if (bs.ownerId !== invitedByUserId) {
      const canInvite =
        await this.bookingSystemPermissionsService.hasPermission(
          invitedByUserId,
          bookingSystemId,
          BookingEntity.BOOKING_SYSTEM_USERS,
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
        bookingSystemId,
        invitedTelegramId,
        status: BookingSystemInvitationStatus.PENDING,
      },
      order: { createdAt: "DESC" },
    });

    if (existingPending) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingPending.createdAt < oneHourAgo) {
        existingPending.status = BookingSystemInvitationStatus.EXPIRED;
        await this.invitationRepository.save(existingPending);
      } else {
        throw new BadRequestException(
          "Пользователь уже приглашён в эту систему бронирования"
        );
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { telegramId: invitedTelegramId },
    });
    if (existingUser) {
      const hasAccess =
        await this.bookingSystemPermissionsService.hasAccessToBookingSystem(
          existingUser.id,
          bookingSystemId
        );
      if (hasAccess) {
        throw new BadRequestException(
          "Пользователь уже имеет доступ к этой системе бронирования"
        );
      }
    }

    const invitation = this.invitationRepository.create({
      bookingSystemId,
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
      relations: ["bookingSystem", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== BookingSystemInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = BookingSystemInvitationStatus.EXPIRED;
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
      await this.bookingSystemPermissionsService.hasAccessToBookingSystem(
        userId,
        invitation.bookingSystemId
      );
    if (!hasAccess) {
      await this.bookingSystemPermissionsService.addUserToBookingSystem(
        invitation.bookingSystemId,
        userId,
        undefined,
        invitation.permissions
      );
      await this.bookingSystemPermissionsService.setBulkPermissions(
        invitation.bookingSystemId,
        userId,
        invitation.permissions,
        invitation.invitedByUserId
      );
    }

    invitation.status = BookingSystemInvitationStatus.ACCEPTED;
    invitation.invitedUserId = userId;
    await this.invitationRepository.save(invitation);
  }

  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["bookingSystem", "invitedByUser"],
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

    invitation.status = BookingSystemInvitationStatus.DECLINED;
    await this.invitationRepository.save(invitation);
  }

  async getBookingSystemInvitations(
    bookingSystemId: string,
    requestedByUserId: string
  ): Promise<BookingSystemInvitation[]> {
    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    if (bs.ownerId !== requestedByUserId) {
      const canView = await this.bookingSystemPermissionsService.hasPermission(
        requestedByUserId,
        bookingSystemId,
        BookingEntity.BOOKING_SYSTEM_USERS,
        PermissionAction.READ
      );
      if (!canView) {
        throw new BadRequestException(
          "Недостаточно прав для просмотра приглашений"
        );
      }
    }

    return this.invitationRepository.find({
      where: { bookingSystemId },
      relations: ["bookingSystem", "invitedByUser", "invitedUser"],
      order: { createdAt: "DESC" },
    });
  }

  async getUserInvitations(userId: string): Promise<BookingSystemInvitation[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.telegramId) {
      return [];
    }

    return this.invitationRepository.find({
      where: { invitedTelegramId: user.telegramId },
      relations: ["bookingSystem", "invitedByUser"],
      order: { createdAt: "DESC" },
    });
  }

  async cancelInvitation(
    bookingSystemId: string,
    invitationId: string,
    cancelledByUserId: string
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, bookingSystemId },
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    const bs = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
    });
    if (!bs) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    if (bs.ownerId !== cancelledByUserId) {
      const canCancel =
        await this.bookingSystemPermissionsService.hasPermission(
          cancelledByUserId,
          bookingSystemId,
          BookingEntity.BOOKING_SYSTEM_USERS,
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
    bookingSystem: { id: string; name: string };
    invitedByUser: { firstName?: string; lastName?: string };
    permissions: Record<BookingEntity, PermissionAction[]>;
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["bookingSystem", "invitedByUser"],
    });

    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== BookingSystemInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = BookingSystemInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истёк");
    }

    return {
      id: invitation.id,
      bookingSystem: {
        id: invitation.bookingSystem.id,
        name: invitation.bookingSystem.name,
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
        status: BookingSystemInvitationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: BookingSystemInvitationStatus.EXPIRED }
    );
  }
}
