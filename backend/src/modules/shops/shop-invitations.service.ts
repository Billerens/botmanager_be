import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import {
  ShopInvitation,
  ShopInvitationStatus,
} from "../../database/entities/shop-invitation.entity";
import { Shop } from "../../database/entities/shop.entity";
import { User } from "../../database/entities/user.entity";
import { ShopEntity } from "../../database/entities/shop-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { ShopPermissionsService } from "./shop-permissions.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class ShopInvitationsService {
  private readonly logger = new Logger(ShopInvitationsService.name);

  constructor(
    @InjectRepository(ShopInvitation)
    private invitationRepository: Repository<ShopInvitation>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private shopPermissionsService: ShopPermissionsService
  ) {}

  async createInvitation(
    shopId: string,
    invitedTelegramId: string,
    permissions: Record<ShopEntity, PermissionAction[]>,
    invitedByUserId: string,
    message?: string
  ): Promise<ShopInvitation> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    if (shop.ownerId !== invitedByUserId) {
      const canInvite = await this.shopPermissionsService.hasPermission(
        invitedByUserId,
        shopId,
        ShopEntity.SHOP_USERS,
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
        shopId,
        invitedTelegramId,
        status: ShopInvitationStatus.PENDING,
      },
      order: { createdAt: "DESC" },
    });

    if (existingPending) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingPending.createdAt < oneHourAgo) {
        existingPending.status = ShopInvitationStatus.EXPIRED;
        await this.invitationRepository.save(existingPending);
      } else {
        throw new BadRequestException(
          "Пользователь уже приглашён в этот магазин"
        );
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { telegramId: invitedTelegramId },
    });
    if (existingUser) {
      const hasAccess = await this.shopPermissionsService.hasAccessToShop(
        existingUser.id,
        shopId
      );
      if (hasAccess) {
        throw new BadRequestException(
          "Пользователь уже имеет доступ к этому магазину"
        );
      }
    }

    const invitation = this.invitationRepository.create({
      shopId,
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
      relations: ["shop", "invitedByUser"],
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== ShopInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = ShopInvitationStatus.EXPIRED;
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

    const hasAccess = await this.shopPermissionsService.hasAccessToShop(
      userId,
      invitation.shopId
    );
    if (!hasAccess) {
      await this.shopPermissionsService.addUserToShop(
        invitation.shopId,
        userId,
        undefined,
        invitation.permissions
      );
      await this.shopPermissionsService.setBulkPermissions(
        invitation.shopId,
        userId,
        invitation.permissions,
        invitation.invitedByUserId
      );
    }

    invitation.status = ShopInvitationStatus.ACCEPTED;
    invitation.invitedUserId = userId;
    await this.invitationRepository.save(invitation);
  }

  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["shop", "invitedByUser"],
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

    invitation.status = ShopInvitationStatus.DECLINED;
    await this.invitationRepository.save(invitation);
  }

  async getShopInvitations(
    shopId: string,
    requestedByUserId: string
  ): Promise<ShopInvitation[]> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    if (shop.ownerId !== requestedByUserId) {
      const canView = await this.shopPermissionsService.hasPermission(
        requestedByUserId,
        shopId,
        ShopEntity.SHOP_USERS,
        PermissionAction.READ
      );
      if (!canView) {
        throw new BadRequestException(
          "Недостаточно прав для просмотра приглашений"
        );
      }
    }

    return this.invitationRepository.find({
      where: { shopId },
      relations: ["shop", "invitedByUser", "invitedUser"],
      order: { createdAt: "DESC" },
    });
  }

  async getUserInvitations(userId: string): Promise<ShopInvitation[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.telegramId) {
      return [];
    }

    return this.invitationRepository.find({
      where: { invitedTelegramId: user.telegramId },
      relations: ["shop", "invitedByUser"],
      order: { createdAt: "DESC" },
    });
  }

  async cancelInvitation(
    shopId: string,
    invitationId: string,
    cancelledByUserId: string
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, shopId },
    });
    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    if (shop.ownerId !== cancelledByUserId) {
      const canCancel = await this.shopPermissionsService.hasPermission(
        cancelledByUserId,
        shopId,
        ShopEntity.SHOP_USERS,
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
    shop: { id: string; name: string };
    invitedByUser: { firstName?: string; lastName?: string };
    permissions: Record<ShopEntity, PermissionAction[]>;
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: token },
      relations: ["shop", "invitedByUser"],
    });

    if (!invitation) {
      throw new NotFoundException("Приглашение не найдено");
    }

    if (invitation.status !== ShopInvitationStatus.PENDING) {
      throw new BadRequestException("Приглашение уже обработано");
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = ShopInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException("Срок действия приглашения истёк");
    }

    return {
      id: invitation.id,
      shop: {
        id: invitation.shop.id,
        name: invitation.shop.name,
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
        status: ShopInvitationStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: ShopInvitationStatus.EXPIRED }
    );
  }
}
