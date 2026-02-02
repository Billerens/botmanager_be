import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ShopUser } from "../../database/entities/shop-user.entity";
import {
  ShopUserPermission,
  ShopEntity,
} from "../../database/entities/shop-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { Shop } from "../../database/entities/shop.entity";
import { User } from "../../database/entities/user.entity";

@Injectable()
export class ShopPermissionsService {
  constructor(
    @InjectRepository(ShopUser)
    private shopUserRepository: Repository<ShopUser>,
    @InjectRepository(ShopUserPermission)
    private shopUserPermissionRepository: Repository<ShopUserPermission>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async hasAccessToShop(userId: string, shopId: string): Promise<boolean> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId, ownerId: userId },
    });
    if (shop) return true;

    const shopUser = await this.shopUserRepository.findOne({
      where: { shopId, userId },
    });
    return !!shopUser;
  }

  async hasPermission(
    userId: string,
    shopId: string,
    entity: ShopEntity,
    action: PermissionAction
  ): Promise<boolean> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId, ownerId: userId },
    });
    if (shop) return true;

    const permission = await this.shopUserPermissionRepository.findOne({
      where: { shopId, userId, entity, action },
    });
    return permission?.granted ?? false;
  }

  async getUserPermissions(
    userId: string,
    shopId: string
  ): Promise<Record<ShopEntity, PermissionAction[]>> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId, ownerId: userId },
    });
    if (shop) {
      const allEntities = Object.values(ShopEntity);
      const allActions = Object.values(PermissionAction);
      return allEntities.reduce(
        (acc, entity) => {
          acc[entity] = [...allActions];
          return acc;
        },
        {} as Record<ShopEntity, PermissionAction[]>
      );
    }

    const permissions = await this.shopUserPermissionRepository.find({
      where: { shopId, userId, granted: true },
    });

    const result: Record<ShopEntity, PermissionAction[]> = {} as Record<
      ShopEntity,
      PermissionAction[]
    >;
    Object.values(ShopEntity).forEach((entity) => {
      result[entity] = [];
    });
    permissions.forEach((permission) => {
      if (!result[permission.entity]) {
        result[permission.entity] = [];
      }
      result[permission.entity].push(permission.action);
    });
    return result;
  }

  async setPermission(
    shopId: string,
    userId: string,
    entity: ShopEntity,
    action: PermissionAction,
    granted: boolean,
    grantedByUserId: string
  ): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const shopUser = await this.shopUserRepository.findOne({
      where: { shopId, userId },
    });
    if (!shopUser) {
      throw new NotFoundException("Пользователь не добавлен к этому магазину");
    }

    const canManageUsers = await this.hasPermission(
      grantedByUserId,
      shopId,
      ShopEntity.SHOP_USERS,
      PermissionAction.UPDATE
    );
    if (grantedByUserId !== shop.ownerId && !canManageUsers) {
      throw new BadRequestException(
        "Недостаточно прав для управления пользователями"
      );
    }

    let permission = await this.shopUserPermissionRepository.findOne({
      where: { shopId, userId, entity, action },
    });

    if (!permission) {
      permission = this.shopUserPermissionRepository.create({
        shopId,
        userId,
        entity,
        action,
        granted,
        grantedByUserId,
      });
    } else {
      permission.granted = granted;
      permission.grantedByUserId = grantedByUserId;
    }
    await this.shopUserPermissionRepository.save(permission);
  }

  async setBulkPermissions(
    shopId: string,
    userId: string,
    permissions: Record<ShopEntity, PermissionAction[]>,
    grantedByUserId: string
  ): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    const canManageUsers = await this.hasPermission(
      grantedByUserId,
      shopId,
      ShopEntity.SHOP_USERS,
      PermissionAction.UPDATE
    );
    if (grantedByUserId !== shop.ownerId && !canManageUsers) {
      throw new BadRequestException(
        "Недостаточно прав для управления пользователями"
      );
    }

    const existingPermissions = await this.shopUserPermissionRepository.find({
      where: { shopId, userId },
    });
    const existingMap = new Map<string, ShopUserPermission>();
    existingPermissions.forEach((p) => {
      existingMap.set(`${p.entity}_${p.action}`, p);
    });

    const toSave: ShopUserPermission[] = [];
    Object.entries(permissions).forEach(([entity, actions]) => {
      Object.values(PermissionAction).forEach((action) => {
        const key = `${entity}_${action}`;
        const shouldGrant = actions.includes(action);
        let permission = existingMap.get(key);
        if (!permission) {
          permission = this.shopUserPermissionRepository.create({
            shopId,
            userId,
            entity: entity as ShopEntity,
            action,
            granted: shouldGrant,
            grantedByUserId,
          });
        } else {
          permission.granted = shouldGrant;
          permission.grantedByUserId = grantedByUserId;
        }
        toSave.push(permission);
        existingMap.delete(key);
      });
    });

    await this.shopUserPermissionRepository.save(toSave);
    if (existingMap.size > 0) {
      await this.shopUserPermissionRepository.remove(
        Array.from(existingMap.values())
      );
    }
    await this.updateShopUserPermissions(shopId, userId, permissions);
  }

  async addUserToShop(
    shopId: string,
    userId: string,
    displayName?: string,
    permissions?: Record<ShopEntity, PermissionAction[]>
  ): Promise<ShopUser> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }
    const existing = await this.shopUserRepository.findOne({
      where: { shopId, userId },
    });
    if (existing) {
      throw new BadRequestException(
        "Пользователь уже добавлен к этому магазину"
      );
    }

    const shopUser = this.shopUserRepository.create({
      shopId,
      userId,
      displayName:
        displayName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.telegramId ||
        userId,
      permissions:
        permissions || ({} as Record<ShopEntity, PermissionAction[]>),
    });
    return this.shopUserRepository.save(shopUser);
  }

  async removeUserFromShop(shopId: string, userId: string): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }
    if (shop.ownerId === userId) {
      throw new BadRequestException("Нельзя удалить владельца магазина");
    }
    await this.shopUserRepository.delete({ shopId, userId });
    await this.shopUserPermissionRepository.delete({ shopId, userId });
  }

  async getShopUsers(shopId: string): Promise<ShopUser[]> {
    return this.shopUserRepository.find({
      where: { shopId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Получить ID магазинов, доступных пользователю (владелец или приглашённый)
   */
  async getShopIdsForUser(userId: string): Promise<string[]> {
    const owned = await this.shopRepository.find({
      where: { ownerId: userId },
      select: ["id"],
    });
    const shared = await this.shopUserRepository.find({
      where: { userId },
      select: ["shopId"],
    });
    const ids = new Set<string>([
      ...owned.map((s) => s.id),
      ...shared.map((su) => su.shopId),
    ]);
    return Array.from(ids);
  }

  private async updateShopUserPermissions(
    shopId: string,
    userId: string,
    permissions: Record<ShopEntity, PermissionAction[]>
  ): Promise<void> {
    await this.shopUserRepository.update({ shopId, userId }, { permissions });
  }
}
