import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Shop } from "../../../database/entities/shop.entity";
import { CustomPage } from "../../../database/entities/custom-page.entity";
import { BookingSystem } from "../../../database/entities/booking-system.entity";
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
    @InjectRepository(CustomPage)
    private readonly customPageRepository: Repository<CustomPage>,
    @InjectRepository(BookingSystem)
    private readonly bookingSystemRepository: Repository<BookingSystem>,
    private readonly subdomainService: SubdomainService
  ) {}

  /**
   * Проверка субдоменов каждые 30 секунд
   *
   * Проверяет все субдомены в промежуточных статусах и обновляет их состояние.
   */
  @Cron("*/30 * * * * *") // Каждые 30 секунд
  async checkPendingSubdomains(): Promise<void> {
    await Promise.all([
      this.checkShopSubdomains(),
      this.checkPageSubdomains(),
      this.checkBookingSystemSubdomains(),
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
   * Проверка субдоменов страниц
   */
  private async checkPageSubdomains(): Promise<void> {
    const pages = await this.customPageRepository.find({
      where: {
        subdomainStatus: In(this.PENDING_STATUSES),
      },
    });

    if (pages.length === 0) return;

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
   * Проверка субдоменов систем бронирования
   */
  private async checkBookingSystemSubdomains(): Promise<void> {
    const bookingSystems = await this.bookingSystemRepository.find({
      where: {
        subdomainStatus: In(this.PENDING_STATUSES),
      },
    });

    if (bookingSystems.length === 0) return;

    for (const bookingSystem of bookingSystems) {
      if (!bookingSystem.slug) continue;

      try {
        const realStatus = await this.subdomainService.checkStatus(
          bookingSystem.slug,
          SubdomainType.BOOKING
        );

        if (realStatus !== bookingSystem.subdomainStatus) {
          await this.updateBookingSystemStatus(bookingSystem, realStatus);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to check subdomain for booking system ${bookingSystem.id}: ${error.message}`
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
    } else if (newStatus === SubdomainStatus.ERROR) {
      shop.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
    }

    await this.shopRepository.save(shop);
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
    } else if (newStatus === SubdomainStatus.ERROR) {
      page.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
    }

    await this.customPageRepository.save(page);
  }

  /**
   * Обновить статус субдомена системы бронирования
   */
  private async updateBookingSystemStatus(
    bookingSystem: BookingSystem,
    newStatus: SubdomainStatus
  ): Promise<void> {
    const oldStatus = bookingSystem.subdomainStatus;
    bookingSystem.subdomainStatus = newStatus;

    if (newStatus === SubdomainStatus.ACTIVE) {
      bookingSystem.subdomainActivatedAt = new Date();
      bookingSystem.subdomainError = null;
    } else if (newStatus === SubdomainStatus.ERROR) {
      bookingSystem.subdomainError =
        "Субдомен не найден в DNS. Попробуйте повторить активацию.";
    }

    await this.bookingSystemRepository.save(bookingSystem);
  }

  /**
   * Получить статистику субдоменов
   */
  async getSubdomainStatistics(): Promise<{
    shops: { total: number; active: number; pending: number; error: number };
    pages: { total: number; active: number; pending: number; error: number };
    bookingSystems: {
      total: number;
      active: number;
      pending: number;
      error: number;
    };
  }> {
    const [shops, pages, bookingSystems] = await Promise.all([
      this.getShopStats(),
      this.getPageStats(),
      this.getBookingSystemStats(),
    ]);

    return { shops, pages, bookingSystems };
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

  private async getBookingSystemStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    error: number;
  }> {
    const [total, active, pending, error] = await Promise.all([
      this.bookingSystemRepository.count({
        where: { subdomainStatus: In(Object.values(SubdomainStatus)) },
      }),
      this.bookingSystemRepository.count({
        where: { subdomainStatus: SubdomainStatus.ACTIVE },
      }),
      this.bookingSystemRepository.count({
        where: { subdomainStatus: In(this.PENDING_STATUSES) },
      }),
      this.bookingSystemRepository.count({
        where: { subdomainStatus: SubdomainStatus.ERROR },
      }),
    ]);
    return { total, active, pending, error };
  }
}
