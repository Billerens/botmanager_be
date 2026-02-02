import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomPageUser } from "../../database/entities/custom-page-user.entity";
import {
  CustomPageUserPermission,
  CustomPageEntity,
} from "../../database/entities/custom-page-user-permission.entity";
import { PermissionAction } from "../../database/entities/bot-user-permission.entity";
import { CustomPage } from "../../database/entities/custom-page.entity";
import { User } from "../../database/entities/user.entity";

@Injectable()
export class CustomPagePermissionsService {
  constructor(
    @InjectRepository(CustomPageUser)
    private customPageUserRepository: Repository<CustomPageUser>,
    @InjectRepository(CustomPageUserPermission)
    private permissionRepository: Repository<CustomPageUserPermission>,
    @InjectRepository(CustomPage)
    private customPageRepository: Repository<CustomPage>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async hasAccessToCustomPage(
    userId: string,
    customPageId: string
  ): Promise<boolean> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId, ownerId: userId },
    });
    if (page) return true;

    const pageUser = await this.customPageUserRepository.findOne({
      where: { customPageId, userId },
    });
    return !!pageUser;
  }

  /**
   * Получить ID кастомных страниц, доступных пользователю (владелец или приглашённый)
   */
  async getCustomPageIdsForUser(userId: string): Promise<string[]> {
    const owned = await this.customPageRepository.find({
      where: { ownerId: userId },
      select: ["id"],
    });
    const shared = await this.customPageUserRepository.find({
      where: { userId },
      select: ["customPageId"],
    });
    const ids = new Set<string>([
      ...owned.map((p) => p.id),
      ...shared.map((pu) => pu.customPageId),
    ]);
    return Array.from(ids);
  }

  async hasPermission(
    userId: string,
    customPageId: string,
    entity: CustomPageEntity,
    action: PermissionAction
  ): Promise<boolean> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId, ownerId: userId },
    });
    if (page) return true;

    const permission = await this.permissionRepository.findOne({
      where: { customPageId, userId, entity, action },
    });
    return permission?.granted ?? false;
  }

  async getUserPermissions(
    userId: string,
    customPageId: string
  ): Promise<Record<CustomPageEntity, PermissionAction[]>> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId, ownerId: userId },
    });
    if (page) {
      const allEntities = Object.values(CustomPageEntity);
      const allActions = Object.values(PermissionAction);
      return allEntities.reduce(
        (acc, entity) => {
          acc[entity] = [...allActions];
          return acc;
        },
        {} as Record<CustomPageEntity, PermissionAction[]>
      );
    }

    const permissions = await this.permissionRepository.find({
      where: { customPageId, userId, granted: true },
    });
    const result: Record<CustomPageEntity, PermissionAction[]> = {} as Record<
      CustomPageEntity,
      PermissionAction[]
    >;
    Object.values(CustomPageEntity).forEach((entity) => {
      result[entity] = [];
    });
    permissions.forEach((p) => {
      if (!result[p.entity]) result[p.entity] = [];
      result[p.entity].push(p.action);
    });
    return result;
  }

  async addUserToCustomPage(
    customPageId: string,
    userId: string,
    displayName?: string,
    permissions?: Record<CustomPageEntity, PermissionAction[]>
  ): Promise<CustomPageUser> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId },
    });
    if (!page) throw new NotFoundException("Кастомная страница не найдена");
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Пользователь не найден");
    const existing = await this.customPageUserRepository.findOne({
      where: { customPageId, userId },
    });
    if (existing) {
      throw new BadRequestException(
        "Пользователь уже добавлен к этой странице"
      );
    }

    const perms =
      permissions || ({} as Record<CustomPageEntity, PermissionAction[]>);
    const pageUser = this.customPageUserRepository.create({
      customPageId,
      userId,
      displayName:
        displayName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.telegramId ||
        userId,
      permissions: perms,
    });
    const saved = await this.customPageUserRepository.save(pageUser);
    await this.syncPermissionsToTable(customPageId, userId, perms);
    return saved;
  }

  /**
   * Синхронизирует карту прав в таблицу custom_page_user_permissions (для hasPermission).
   */
  private async syncPermissionsToTable(
    customPageId: string,
    userId: string,
    permissions: Record<CustomPageEntity, PermissionAction[]>
  ): Promise<void> {
    const toSave: Partial<CustomPageUserPermission>[] = [];
    for (const [entity, actions] of Object.entries(permissions)) {
      if (!actions?.length) continue;
      for (const action of actions) {
        toSave.push({
          customPageId,
          userId,
          entity: entity as CustomPageEntity,
          action: action as PermissionAction,
          granted: true,
        });
      }
    }
    if (toSave.length > 0) {
      await this.permissionRepository.save(
        toSave.map((p) => this.permissionRepository.create(p))
      );
    }
  }

  async removeUserFromCustomPage(
    customPageId: string,
    userId: string
  ): Promise<void> {
    const page = await this.customPageRepository.findOne({
      where: { id: customPageId },
    });
    if (!page) throw new NotFoundException("Кастомная страница не найдена");
    if (page.ownerId === userId) {
      throw new BadRequestException("Нельзя удалить владельца страницы");
    }
    await this.customPageUserRepository.delete({ customPageId, userId });
    await this.permissionRepository.delete({ customPageId, userId });
  }

  async getCustomPageUsers(customPageId: string): Promise<CustomPageUser[]> {
    return this.customPageUserRepository.find({
      where: { customPageId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }
}
