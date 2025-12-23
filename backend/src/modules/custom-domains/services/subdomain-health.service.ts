import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Shop } from "../../../database/entities/shop.entity";
import { Bot } from "../../../database/entities/bot.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { SubdomainStatus, SubdomainType } from "../enums/domain-status.enum";
import { SubdomainService } from "./subdomain.service";

/**
 * Фоновый сервис для проверки здоровья субдоменов платформы
 *
 * Периодически проверяет субдомены в промежуточных статусах (ACTIVATING)
 * и обновляет их статус при успешной активации.
 */
@Injectable()
export class SubdomainHealthService {
  private readonly logger = new Logger(SubdomainHealthService.name);

  /** Статусы, требующие проверки */
  private readonly PENDING_STATUSES = [
    SubdomainStatus.PENDING,
    SubdomainStatus.DNS_CREATING,
    SubdomainStatus.ACTIVATING,
  ];

  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Bot)
    private readonly botRepository: Repository<Bot>,
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    private readonly subdomainService: SubdomainService
  ) {}

  /**
   * Проверка субдоменов каждые 30 секунд
   *
   * Проверяет все субдомены в промежуточных статусах и обновляет их состояние.
   */
  @Cron("*/30 * * * * *") // Каждые 30 секунд
  async checkPendingSubdomains(): Promise<void> {
    this.logger.debug("Checking pending subdomains...");
    await Promise.all([
      this.checkShopSubdomains(),
      this.checkBotSubdomains(),
      this.checkPageSubdomains(),
    ]);
  }

  /**
   * Проверка субдоменов магазинов
   */
  private async checkShopSubdomains(): Promise<void> {
    const shops = await this.shopRepository.find({
      where: {
        subdomainStatus: In(this.PENDING_STATUSES),
      },
    });

    if (shops.length === 0) return;

    this.logger.debug(`Checking ${shops.length} shop subdomains...`);

    for (const shop of shops) {
      if (!shop.slug) continue;

      try {
        const realStatus = await this.subdomainService.checkStatus(
          shop.slug,
          SubdomainType.SHOP
        );

        if (realStatus !== shop.subdomainStatus) {
          await this.updateShopStatus(shop, realStatus);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to check subdomain for shop ${shop.id}: ${error.message}`
        );
      }
    }
  }

  /**
   * Проверка субдоменов бронирования (боты)
   */
  private async checkBotSubdomains(): Promise<void> {
    const bots = await this.botRepository.find({
      where: {
        subdomainStatus: In(this.PENDING_STATUSES),
      },
    });

    if (bots.length === 0) return;

    this.logger.debug(`Checking ${bots.length} bot subdomains...`);

    for (const bot of bots) {
      if (!bot.slug) continue;

      try {
        const realStatus = await this.subdomainService.checkStatus(
          bot.slug,
          SubdomainType.BOOKING
        );

        if (realStatus !== bot.subdomainStatus) {
          await this.updateBotStatus(bot, realStatus);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to check subdomain for bot ${bot.id}: ${error.message}`
        );
      }
    }
  }

  /**
   * Проверка субдоменов страниц
   */
  private async checkPageSubdomains(): Promise<void> {
    const pages = await this.customPageRepository.find({
      where: {
        subdomainStatus: In(this.PENDING_STATUSES),
      },
    });

    if (pages.length === 0) return;

    this.logger.debug(`Checking ${pages.length} page subdomains...`);

    for (const page of pages) {
      if (!page.slug) continue;

      try {
        const realStatus = await this.subdomainService.checkStatus(
          page.slug,
          SubdomainType.PAGE
        );

        if (realStatus !== page.subdomainStatus) {
          await this.updatePageStatus(page, realStatus);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to check subdomain for page ${page.id}: ${error.message}`
        );
      }
    }
  }

  /**
   * Обновить статус субдомена магазина
   */
  private async updateShopStatus(
    shop: Shop,
    newStatus: SubdomainStatus
  ): Promise<void> {
    const oldStatus = shop.subdomainStatus;
    shop.subdomainStatus = newStatus;

    if (newStatus === SubdomainStatus.ACTIVE) {
      shop.subdomainActivatedAt = new Date();
      shop.subdomainError = null;
      this.logger.log(
        `Shop ${shop.id} subdomain activated: ${shop.subdomainUrl}`
      );
    } else if (newStatus === SubdomainStatus.ERROR) {
      shop.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
      this.logger.warn(`Shop ${shop.id} subdomain error: not found in DNS`);
    }

    await this.shopRepository.save(shop);
    this.logger.debug(
      `Shop ${shop.id} subdomain status: ${oldStatus} → ${newStatus}`
    );
  }

  /**
   * Обновить статус субдомена бота
   */
  private async updateBotStatus(
    bot: Bot,
    newStatus: SubdomainStatus
  ): Promise<void> {
    const oldStatus = bot.subdomainStatus;
    bot.subdomainStatus = newStatus;

    if (newStatus === SubdomainStatus.ACTIVE) {
      bot.subdomainActivatedAt = new Date();
      bot.subdomainError = null;
      this.logger.log(`Bot ${bot.id} subdomain activated: ${bot.subdomainUrl}`);
    } else if (newStatus === SubdomainStatus.ERROR) {
      bot.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
      this.logger.warn(`Bot ${bot.id} subdomain error: not found in DNS`);
    }

    await this.botRepository.save(bot);
    this.logger.debug(
      `Bot ${bot.id} subdomain status: ${oldStatus} → ${newStatus}`
    );
  }

  /**
   * Обновить статус субдомена страницы
   */
  private async updatePageStatus(
    page: CustomPage,
    newStatus: SubdomainStatus
  ): Promise<void> {
    const oldStatus = page.subdomainStatus;
    page.subdomainStatus = newStatus;

    if (newStatus === SubdomainStatus.ACTIVE) {
      page.subdomainActivatedAt = new Date();
      page.subdomainError = null;
      this.logger.log(
        `Page ${page.id} subdomain activated: ${page.subdomainUrl}`
      );
    } else if (newStatus === SubdomainStatus.ERROR) {
      page.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
      this.logger.warn(`Page ${page.id} subdomain error: not found in DNS`);
    }

    await this.customPageRepository.save(page);
    this.logger.debug(
      `Page ${page.id} subdomain status: ${oldStatus} → ${newStatus}`
    );
  }

  /**
   * Получить статистику субдоменов
   */
  async getSubdomainStatistics(): Promise<{
    shops: { total: number; active: number; pending: number; error: number };
    bots: { total: number; active: number; pending: number; error: number };
    pages: { total: number; active: number; pending: number; error: number };
  }> {
    const [shops, bots, pages] = await Promise.all([
      this.getShopStats(),
      this.getBotStats(),
      this.getPageStats(),
    ]);

    return { shops, bots, pages };
  }

  private async getShopStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    error: number;
  }> {
    const [total, active, pending, error] = await Promise.all([
      this.shopRepository.count({
        where: { subdomainStatus: In(Object.values(SubdomainStatus)) },
      }),
      this.shopRepository.count({
        where: { subdomainStatus: SubdomainStatus.ACTIVE },
      }),
      this.shopRepository.count({
        where: { subdomainStatus: In(this.PENDING_STATUSES) },
      }),
      this.shopRepository.count({
        where: { subdomainStatus: SubdomainStatus.ERROR },
      }),
    ]);
    return { total, active, pending, error };
  }

  private async getBotStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    error: number;
  }> {
    const [total, active, pending, error] = await Promise.all([
      this.botRepository.count({
        where: { subdomainStatus: In(Object.values(SubdomainStatus)) },
      }),
      this.botRepository.count({
        where: { subdomainStatus: SubdomainStatus.ACTIVE },
      }),
      this.botRepository.count({
        where: { subdomainStatus: In(this.PENDING_STATUSES) },
      }),
      this.botRepository.count({
        where: { subdomainStatus: SubdomainStatus.ERROR },
      }),
    ]);
    return { total, active, pending, error };
  }

  private async getPageStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    error: number;
  }> {
    const [total, active, pending, error] = await Promise.all([
      this.customPageRepository.count({
        where: { subdomainStatus: In(Object.values(SubdomainStatus)) },
      }),
      this.customPageRepository.count({
        where: { subdomainStatus: SubdomainStatus.ACTIVE },
      }),
      this.customPageRepository.count({
        where: { subdomainStatus: In(this.PENDING_STATUSES) },
      }),
      this.customPageRepository.count({
        where: { subdomainStatus: SubdomainStatus.ERROR },
      }),
    ]);
    return { total, active, pending, error };
  }
}
