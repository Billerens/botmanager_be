import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Bot } from "../../../database/entities/bot.entity";
import { Shop } from "../../../database/entities/shop.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { CustomDataOwnerType } from "../../../database/entities/custom-collection-schema.entity";
import { BotPermissionsService } from "../../bots/bot-permissions.service";
import { PermissionAction, BotEntity } from "../../../database/entities/bot-user-permission.entity";

/**
 * Guard для проверки владения сущностью перед доступом к кастомным данным.
 * Проверяет, что текущий пользователь является владельцем сущности
 * (бота, магазина, системы бронирования или кастомной страницы).
 */
@Injectable()
export class CustomDataOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(CustomDataOwnershipGuard.name);

  constructor(
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    private readonly botPermissionsService: BotPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ownerType = request.params?.ownerType as CustomDataOwnerType;
    const ownerId = request.params?.ownerId;

    if (!user) {
      throw new ForbiddenException("Пользователь не авторизован");
    }

    if (!ownerType || !ownerId) {
      throw new ForbiddenException("ownerType и ownerId обязательны");
    }

    const userId = user.id;

    this.logger.debug(
      `Checking ownership: user=${userId}, ownerType=${ownerType}, ownerId=${ownerId}`,
    );

    try {
      switch (ownerType) {
        case CustomDataOwnerType.BOT:
          return await this.checkBotOwnership(userId, ownerId);

        case CustomDataOwnerType.SHOP:
          return await this.checkShopOwnership(userId, ownerId);

        case CustomDataOwnerType.BOOKING:
          return await this.checkBookingSystemOwnership(userId, ownerId);

        case CustomDataOwnerType.CUSTOM_PAGE:
          return await this.checkCustomPageOwnership(userId, ownerId);

        case CustomDataOwnerType.CUSTOM_APP:
          // TODO: Реализовать проверку для custom_app когда будет готова сущность
          throw new ForbiddenException("Custom App пока не поддерживается");

        default:
          throw new ForbiddenException(`Неизвестный тип владельца: ${ownerType}`);
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error checking ownership: ${error.message}`, error.stack);
      throw new ForbiddenException("Ошибка проверки прав доступа");
    }
  }

  /**
   * Проверка владения ботом.
   * Пользователь должен быть владельцем бота или иметь права доступа.
   */
  private async checkBotOwnership(userId: string, botId: string): Promise<boolean> {
    const bot = await this.botRepository.findOne({ where: { id: botId } });

    if (!bot) {
      throw new NotFoundException("Бот не найден");
    }

    // Проверяем, является ли пользователь владельцем бота
    if (bot.ownerId === userId) {
      return true;
    }

    // Проверяем, есть ли у пользователя права на бота через систему разрешений
    const hasPermission = await this.botPermissionsService.hasPermission(
      userId,
      botId,
      BotEntity.BOT,
      PermissionAction.READ,
    );

    if (!hasPermission) {
      throw new ForbiddenException("Нет доступа к этому боту");
    }

    return true;
  }

  /**
   * Проверка владения магазином.
   * Пользователь должен быть владельцем магазина или связанного бота.
   */
  private async checkShopOwnership(userId: string, shopId: string): Promise<boolean> {
    const shop = await this.shopRepository.findOne({
      where: { id: shopId },
      relations: ["bot"],
    });

    if (!shop) {
      throw new NotFoundException("Магазин не найден");
    }

    // Проверяем, является ли пользователь владельцем магазина
    if (shop.ownerId === userId) {
      return true;
    }

    // Проверяем, является ли пользователь владельцем связанного бота
    if (shop.bot && shop.bot.ownerId === userId) {
      return true;
    }

    // Проверяем права через систему разрешений бота
    if (shop.botId) {
      const hasPermission = await this.botPermissionsService.hasPermission(
        userId,
        shop.botId,
        BotEntity.SHOP,
        PermissionAction.READ,
      );

      if (hasPermission) {
        return true;
      }
    }

    throw new ForbiddenException("Нет доступа к этому магазину");
  }

  /**
   * Проверка владения системой бронирования.
   * Пользователь должен быть владельцем системы или связанного бота.
   */
  private async checkBookingSystemOwnership(
    userId: string,
    bookingSystemId: string,
  ): Promise<boolean> {
    const bookingSystem = await this.bookingSystemRepository.findOne({
      where: { id: bookingSystemId },
      relations: ["bot"],
    });

    if (!bookingSystem) {
      throw new NotFoundException("Система бронирования не найдена");
    }

    // Проверяем, является ли пользователь владельцем системы бронирования
    if (bookingSystem.ownerId === userId) {
      return true;
    }

    // Проверяем, является ли пользователь владельцем связанного бота
    if (bookingSystem.bot && bookingSystem.bot.ownerId === userId) {
      return true;
    }

    // Проверяем права через систему разрешений бота
    if (bookingSystem.botId) {
      const hasPermission = await this.botPermissionsService.hasPermission(
        userId,
        bookingSystem.botId,
        BotEntity.BOOKING,
        PermissionAction.READ,
      );

      if (hasPermission) {
        return true;
      }
    }

    throw new ForbiddenException("Нет доступа к этой системе бронирования");
  }

  /**
   * Проверка владения кастомной страницей.
   * Пользователь должен быть владельцем страницы или связанного бота/магазина.
   */
  private async checkCustomPageOwnership(
    userId: string,
    pageId: string,
  ): Promise<boolean> {
    const page = await this.customPageRepository.findOne({
      where: { id: pageId },
      relations: ["bot", "shop"],
    });

    if (!page) {
      throw new NotFoundException("Кастомная страница не найдена");
    }

    // Проверяем, является ли пользователь владельцем страницы
    if (page.ownerId === userId) {
      return true;
    }

    // Проверяем, является ли пользователь владельцем связанного бота
    if (page.bot && page.bot.ownerId === userId) {
      return true;
    }

    // Проверяем, является ли пользователь владельцем связанного магазина
    if (page.shop && page.shop.ownerId === userId) {
      return true;
    }

    // Проверяем права через систему разрешений бота
    if (page.botId) {
      const hasPermission = await this.botPermissionsService.hasPermission(
        userId,
        page.botId,
        BotEntity.CUSTOM_PAGES,
        PermissionAction.READ,
      );

      if (hasPermission) {
        return true;
      }
    }

    throw new ForbiddenException("Нет доступа к этой кастомной странице");
  }
}
