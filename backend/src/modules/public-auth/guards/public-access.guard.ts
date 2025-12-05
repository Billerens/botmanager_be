import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Bot } from "../../../database/entities/bot.entity";
import { PublicUser } from "../../../database/entities/public-user.entity";
import { TelegramInitDataValidationService } from "../../../common/telegram-initdata-validation.service";
import { BotsService } from "../../bots/bots.service";
import { PublicUserJwtPayload } from "../public-auth.service";

export type AuthType = "telegram" | "browser" | "none";

export interface PublicAccessRequest extends Request {
  authType: AuthType;
  telegramUser?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  publicUser?: PublicUser;
  bot?: Bot;
}

/**
 * Универсальный guard для публичного доступа к shop/booking
 * Поддерживает авторизацию через:
 * 1. Telegram initData (для Telegram WebApp)
 * 2. JWT токен (для браузера)
 *
 * Проверяет настройки бота для разрешения браузерного доступа
 */
@Injectable()
export class PublicAccessGuard implements CanActivate {
  private readonly logger = new Logger(PublicAccessGuard.name);

  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(PublicUser)
    private publicUserRepository: Repository<PublicUser>,
    private initDataValidationService: TelegramInitDataValidationService,
    private botsService: BotsService,
    private jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const botId = request.params?.botId || request.params?.id;

    if (!botId) {
      this.logger.warn("botId не найден в параметрах запроса");
      throw new UnauthorizedException("botId обязателен");
    }

    // Находим бота
    const bot = await this.botRepository.findOne({
      where: { id: botId },
    });

    if (!bot) {
      this.logger.warn(`Бот с ID ${botId} не найден`);
      throw new UnauthorizedException("Бот не найден");
    }

    request.bot = bot;

    // 1. Пробуем Telegram initData
    const initData =
      request.headers["x-telegram-init-data"] ||
      request.query?.initData ||
      request.body?.initData;

    if (initData) {
      const telegramAuth = await this.tryTelegramAuth(initData, bot, request);
      if (telegramAuth) {
        return true;
      }
    }

    // 2. Пробуем JWT токен браузера
    const authHeader = request.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const browserAuth = await this.tryBrowserAuth(
        authHeader.substring(7),
        bot,
        request
      );
      if (browserAuth) {
        return true;
      }
    }

    // 3. Проверяем, можно ли использовать гостевой доступ
    // Гостевой доступ может быть разрешен для просмотра каталога
    // но для действий (корзина, заказы) нужна авторизация
    const isReadOnlyEndpoint = this.isReadOnlyEndpoint(request);
    
    if (isReadOnlyEndpoint) {
      // Разрешаем доступ без авторизации для чтения данных
      request.authType = "none";
      return true;
    }

    // Для записи требуется авторизация
    throw new UnauthorizedException(
      "Требуется авторизация. Войдите через Telegram или зарегистрируйтесь."
    );
  }

  /**
   * Попытка аутентификации через Telegram initData
   */
  private async tryTelegramAuth(
    initData: string,
    bot: Bot,
    request: any
  ): Promise<boolean> {
    try {
      // Расшифровываем токен бота
      let botToken: string;
      try {
        botToken = this.botsService.decryptToken(bot.token);
      } catch (error) {
        this.logger.error("Ошибка расшифровки токена бота:", error);
        return false;
      }

      // Валидируем initData
      const validatedData = this.initDataValidationService.validateInitData(
        initData,
        botToken
      );

      if (!validatedData) {
        this.logger.warn("Валидация Telegram initData не прошла");
        return false;
      }

      // Сохраняем данные в request
      request.authType = "telegram";
      request.telegramUser = validatedData.user;
      request.telegramInitData = validatedData;

      return true;
    } catch (error) {
      this.logger.error("Ошибка Telegram аутентификации:", error);
      return false;
    }
  }

  /**
   * Попытка аутентификации через JWT токен браузера
   */
  private async tryBrowserAuth(
    token: string,
    bot: Bot,
    request: any
  ): Promise<boolean> {
    try {
      // Проверяем, разрешен ли браузерный доступ для этого бота
      const isShopRoute = this.isShopRoute(request);
      const isBookingRoute = this.isBookingRoute(request);

      if (isShopRoute && !bot.shopBrowserAccessEnabled) {
        this.logger.warn(
          `Браузерный доступ к магазину отключен для бота ${bot.id}`
        );
        throw new ForbiddenException(
          "Браузерный доступ к магазину отключен для этого бота"
        );
      }

      if (isBookingRoute && !bot.bookingBrowserAccessEnabled) {
        this.logger.warn(
          `Браузерный доступ к бронированию отключен для бота ${bot.id}`
        );
        throw new ForbiddenException(
          "Браузерный доступ к бронированию отключен для этого бота"
        );
      }

      // Верифицируем JWT токен
      const payload = this.jwtService.verify<PublicUserJwtPayload>(token);

      // Проверяем, что это токен публичного пользователя
      if (payload.type !== "public") {
        return false;
      }

      // Получаем пользователя
      const user = await this.publicUserRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        return false;
      }

      // Проверяем верификацию email если требуется
      if (bot.browserAccessRequireEmailVerification && !user.isEmailVerified) {
        throw new ForbiddenException(
          "Для доступа необходимо подтвердить email"
        );
      }

      // Сохраняем данные в request
      request.authType = "browser";
      request.publicUser = user;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.debug("Ошибка браузерной аутентификации:", error);
      return false;
    }
  }

  /**
   * Проверка, является ли эндпоинт read-only
   */
  private isReadOnlyEndpoint(request: any): boolean {
    const method = request.method?.toUpperCase();
    const path = request.path || request.url || "";

    // GET запросы к каталогу, товарам, услугам - read-only
    if (method === "GET") {
      // Исключаем корзину и заказы - для них нужна авторизация
      if (
        path.includes("/cart") ||
        path.includes("/orders") ||
        path.includes("/bookings")
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Проверка, относится ли запрос к магазину
   */
  private isShopRoute(request: any): boolean {
    const path = request.path || request.url || "";
    return (
      path.includes("/shop") ||
      path.includes("/cart") ||
      path.includes("/orders") ||
      path.includes("/products")
    );
  }

  /**
   * Проверка, относится ли запрос к бронированию
   */
  private isBookingRoute(request: any): boolean {
    const path = request.path || request.url || "";
    return (
      path.includes("/booking") ||
      path.includes("/bookings") ||
      path.includes("/time-slots") ||
      path.includes("/specialists") ||
      path.includes("/services")
    );
  }
}

