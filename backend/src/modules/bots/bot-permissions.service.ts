import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BotUser } from "../../database/entities/bot-user.entity";
import {
  BotUserPermission,
  PermissionAction,
  BotEntity,
} from "../../database/entities/bot-user-permission.entity";
import { Bot } from "../../database/entities/bot.entity";
import { User } from "../../database/entities/user.entity";

@Injectable()
export class BotPermissionsService {
  constructor(
    @InjectRepository(BotUser)
    private botUserRepository: Repository<BotUser>,
    @InjectRepository(BotUserPermission)
    private botUserPermissionRepository: Repository<BotUserPermission>,
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  /**
   * Проверяет, имеет ли пользователь доступ к боту
   */
  async hasAccessToBot(userId: string, botId: string): Promise<boolean> {
    // Сначала проверяем, является ли пользователь владельцем бота
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });
    if (bot) return true;

    // Затем проверяем, есть ли пользователь в списке пользователей бота
    const botUser = await this.botUserRepository.findOne({
      where: { botId, userId },
    });
    return !!botUser;
  }

  /**
   * Проверяет конкретное разрешение пользователя на боте
   */
  async hasPermission(
    userId: string,
    botId: string,
    entity: BotEntity,
    action: PermissionAction
  ): Promise<boolean> {
    // Владелец всегда имеет полный доступ
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });
    if (bot) return true;

    // Проверяем детальное разрешение
    const permission = await this.botUserPermissionRepository.findOne({
      where: { botId, userId, entity, action },
    });

    return permission?.granted ?? false;
  }

  /**
   * Получает все разрешения пользователя на боте
   */
  async getUserPermissions(
    userId: string,
    botId: string
  ): Promise<Record<BotEntity, PermissionAction[]>> {
    // Владелец всегда имеет полный доступ
    const bot = await this.botRepository.findOne({
      where: { id: botId, ownerId: userId },
    });
    if (bot) {
      // Возвращаем все возможные разрешения для владельца
      const allEntities = Object.values(BotEntity);
      const allActions = Object.values(PermissionAction);
      return allEntities.reduce(
        (acc, entity) => {
          acc[entity] = [...allActions];
          return acc;
        },
        {} as Record<BotEntity, PermissionAction[]>
      );
    }

    // Получаем детальные разрешения из базы
    const permissions = await this.botUserPermissionRepository.find({
      where: { botId, userId, granted: true },
    });

    // Группируем по сущностям
    const result: Record<BotEntity, PermissionAction[]> = {} as Record<
      BotEntity,
      PermissionAction[]
    >;

    // Инициализируем пустые массивы
    Object.values(BotEntity).forEach((entity) => {
      result[entity] = [];
    });

    // Заполняем разрешенными действиями
    permissions.forEach((permission) => {
      if (!result[permission.entity]) {
        result[permission.entity] = [];
      }
      result[permission.entity].push(permission.action);
    });

    return result;
  }

  /**
   * Устанавливает разрешение для пользователя
   */
  async setPermission(
    botId: string,
    userId: string,
    entity: BotEntity,
    action: PermissionAction,
    granted: boolean,
    grantedByUserId: string
  ): Promise<void> {
    // Проверяем, что бот существует
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем, что пользователь добавлен к боту
    const botUser = await this.botUserRepository.findOne({
      where: { botId, userId },
    });
    if (!botUser) {
      throw new NotFoundException("Пользователь не добавлен к этому боту");
    }

    // Проверяем, что устанавливающий пользователь имеет право управлять пользователями
    const canManageUsers = await this.hasPermission(
      grantedByUserId,
      botId,
      BotEntity.BOT_USERS,
      PermissionAction.UPDATE
    );
    if (grantedByUserId !== bot.ownerId && !canManageUsers) {
      throw new BadRequestException(
        "Недостаточно прав для управления пользователями"
      );
    }

    // Находим или создаем запись о разрешении
    let permission = await this.botUserPermissionRepository.findOne({
      where: { botId, userId, entity, action },
    });

    if (!permission) {
      permission = this.botUserPermissionRepository.create({
        botId,
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

    await this.botUserPermissionRepository.save(permission);
  }

  /**
   * Обновляет все разрешения пользователя на боте
   */
  async setBulkPermissions(
    botId: string,
    userId: string,
    permissions: Record<BotEntity, PermissionAction[]>,
    grantedByUserId: string
  ): Promise<void> {
    // Проверяем, что бот существует
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем права устанавливающего пользователя
    const canManageUsers = await this.hasPermission(
      grantedByUserId,
      botId,
      BotEntity.BOT_USERS,
      PermissionAction.UPDATE
    );
    if (grantedByUserId !== bot.ownerId && !canManageUsers) {
      throw new BadRequestException(
        "Недостаточно прав для управления пользователями"
      );
    }

    // Получаем текущие разрешения
    const existingPermissions = await this.botUserPermissionRepository.find({
      where: { botId, userId },
    });

    // Создаем map для быстрого поиска
    const existingMap = new Map<string, BotUserPermission>();
    existingPermissions.forEach((p) => {
      const key = `${p.entity}_${p.action}`;
      existingMap.set(key, p);
    });

    // Обрабатываем каждое разрешение
    const toSave: BotUserPermission[] = [];

    Object.entries(permissions).forEach(([entity, actions]) => {
      Object.values(PermissionAction).forEach((action) => {
        const key = `${entity}_${action}`;
        const shouldGrant = actions.includes(action);

        let permission = existingMap.get(key);
        if (!permission) {
          permission = this.botUserPermissionRepository.create({
            botId,
            userId,
            entity: entity as BotEntity,
            action,
            granted: shouldGrant,
            grantedByUserId,
          });
        } else {
          permission.granted = shouldGrant;
          permission.grantedByUserId = grantedByUserId;
        }

        toSave.push(permission);
        existingMap.delete(key); // Удаляем из map, чтобы знать что обработали
      });
    });

    // Сохраняем изменения
    await this.botUserPermissionRepository.save(toSave);

    // Удаляем неиспользуемые разрешения (которые были сняты)
    if (existingMap.size > 0) {
      const toDelete = Array.from(existingMap.values());
      await this.botUserPermissionRepository.remove(toDelete);
    }

    // Обновляем кэшированные разрешения в BotUser
    await this.updateBotUserPermissions(botId, userId, permissions);
  }

  /**
   * Добавляет пользователя к боту
   */
  async addUserToBot(
    botId: string,
    userId: string,
    displayName?: string,
    permissions?: Record<BotEntity, PermissionAction[]>
  ): Promise<BotUser> {
    // Проверяем, что бот существует
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем, что пользователь существует
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    // Проверяем, что пользователь еще не добавлен
    const existingBotUser = await this.botUserRepository.findOne({
      where: { botId, userId },
    });
    if (existingBotUser) {
      throw new BadRequestException("Пользователь уже добавлен к этому боту");
    }

    // Создаем запись
    const botUser = this.botUserRepository.create({
      botId,
      userId,
      displayName: displayName || `${user.firstName} ${user.lastName}`.trim(),
      permissions: permissions || {},
    });

    return await this.botUserRepository.save(botUser);
  }

  /**
   * Удаляет пользователя из бота
   */
  async removeUserFromBot(botId: string, userId: string): Promise<void> {
    // Проверяем, что бот существует
    const bot = await this.botRepository.findOne({ where: { id: botId } });
    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Нельзя удалить владельца
    if (bot.ownerId === userId) {
      throw new BadRequestException("Нельзя удалить владельца бота");
    }

    // Удаляем пользователя
    await this.botUserRepository.delete({ botId, userId });

    // Удаляем все его разрешения
    await this.botUserPermissionRepository.delete({ botId, userId });
  }

  /**
   * Получает всех пользователей бота
   */
  async getBotUsers(botId: string): Promise<BotUser[]> {
    return await this.botUserRepository.find({
      where: { botId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Получает боты доступные пользователю
   */
  async getUserBots(userId: string): Promise<Bot[]> {
    // Получаем боты где пользователь владелец
    const ownedBots = await this.botRepository.find({
      where: { ownerId: userId },
    });

    // Получаем боты где пользователь добавлен как пользователь
    const botUsers = await this.botUserRepository.find({
      where: { userId },
      relations: ["bot"],
    });

    const sharedBots = botUsers.map((bu) => bu.bot);

    // Объединяем и удаляем дубликаты
    const allBots = [...ownedBots, ...sharedBots];
    const uniqueBots = allBots.filter(
      (bot, index, self) => self.findIndex((b) => b.id === bot.id) === index
    );

    return uniqueBots;
  }

  /**
   * Обновляет кэшированные разрешения в BotUser
   */
  private async updateBotUserPermissions(
    botId: string,
    userId: string,
    permissions: Record<BotEntity, PermissionAction[]>
  ): Promise<void> {
    await this.botUserRepository.update({ botId, userId }, { permissions });
  }
}
