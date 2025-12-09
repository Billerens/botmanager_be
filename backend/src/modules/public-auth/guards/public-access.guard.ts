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
import { Shop } from "../../../database/entities/shop.entity";
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
  shop?: Shop;
}

/**
 * Универсальный guard для публичного доступа к shop/booking
 * Поддерживает авторизацию через:
 * 1. Telegram initData (для Telegram WebApp)
 * 2. JWT токен (для браузера)
 *
 * Поддерживает роуты:
 * - /public/shops/:id/* - через shopId
 * - /public/bots/:botId/* - через botId (legacy для Telegram)
 */
@Injectable()
export class PublicAccessGuard implements CanActivate {
  private readonly logger = new Logger(PublicAccessGuard.name);

  constructor(
    @InjectRepository(Bot)
    private botRepository: Repository<Bot>,
    @InjectRepository(Shop)
    private shopRepository: Repository<Shop>,
    @InjectRepository(PublicUser)
    private publicUserRepository: Repository<PublicUser>,
    private initDataValidationService: TelegramInitDataValidationService,
    private botsService: BotsService,
    private jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url || "";

    // Определяем режим работы: shop или bot
    const isShopRoute = path.includes("/shops/");
    const shopId = request.params?.id;
    const botId = request.params?.botId;

    let shop: Shop | null = null;
    let bot: Bot | null = null;

    if (isShopRoute && shopId) {
      // Режим магазина - ищем Shop напрямую
      shop = await this.shopRepository.findOne({
        where: { id: shopId },
      });

      if (!shop) {
        this.logger.warn(`Магазин с ID ${shopId} не найден`);
        throw new UnauthorizedException("Магазин не найден");
      }

      request.shop = shop;

      // Если у магазина есть связанный бот, получаем его для Telegram авторизации
      if (shop.botId) {
        bot = await this.botRepository.findOne({
          where: { id: shop.botId },
        });
        if (bot) {
          request.bot = bot;
        }
      }
    } else if (botId) {
      // Legacy режим бота - для Telegram Mini App
      bot = await this.botRepository.findOne({
        where: { id: botId },
      });

      if (!bot) {
        this.logger.warn(`Бот с ID ${botId} не найден`);
        throw new UnauthorizedException("Бот не найден");
      }

      request.bot = bot;

      // Ищем связанный магазин
      shop = await this.shopRepository.findOne({
        where: { botId: bot.id },
      });

      if (shop) {
        request.shop = shop;
      }
    } else {
      this.logger.warn("shopId или botId не найден в параметрах запроса");
      throw new UnauthorizedException("shopId или botId обязателен");
    }

    // 1. Пробуем Telegram initData (только если есть bot)
    if (bot) {
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
    }

    // 2. Пробуем JWT токен браузера
    const authHeader = request.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const browserAuth = await this.tryBrowserAuth(
        authHeader.substring(7),
        shop,
        request
      );
      if (browserAuth) {
        return true;
      }
    }

    // 3. Проверяем, можно ли использовать гостевой доступ
    const isReadOnlyEndpoint = this.isReadOnlyEndpoint(request);

    if (isReadOnlyEndpoint) {
      request.authType = "none";
      return true;
    }

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
      let botToken: string;
      try {
        botToken = this.botsService.decryptToken(bot.token);
      } catch (error) {
        this.logger.error("Ошибка расшифровки токена бота:", error);
        return false;
      }

      const validatedData = this.initDataValidationService.validateInitData(
        initData,
        botToken
      );

      if (!validatedData) {
        this.logger.warn("Валидация Telegram initData не прошла");
        return false;
      }

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
    shop: Shop | null,
    request: any
  ): Promise<boolean> {
    try {
      // Проверяем, разрешен ли браузерный доступ для магазина
      if (shop && !shop.browserAccessEnabled) {
        this.logger.warn(
          `Браузерный доступ к магазину отключен для ${shop.id}`
        );
        throw new ForbiddenException("Браузерный доступ к магазину отключен");
      }

      // Верифицируем JWT токен
      const payload = this.jwtService.verify<PublicUserJwtPayload>(token);

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

    if (method === "GET") {
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
}
